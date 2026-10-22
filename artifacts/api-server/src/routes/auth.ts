import { Router, type RequestHandler } from "express";
import { logAuthCodeEvent } from "../lib/authCodeLog";
import { db, academyUserBasicDetailsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveAcademyUserId } from "../lib/auth";
import { createAuthToken } from "../lib/authTokens";
import {
  getAcademyUserBasicDetails,
  normalizePaymentStatusValue,
  resolveAcademyUserDisplayName,
  sanitizeProfilePicUrl,
} from "../lib/academyUserProfile";

const router = Router();

// SSO tokens are re-verified on every dashboard request, so the TTL doubles as
// the effective session length. Configurable via FORMS_TOKEN_TTL_MINUTES.
const TOKEN_TTL_MINUTES = Number(process.env["FORMS_TOKEN_TTL_MINUTES"]) || 15;
const TOKEN_TTL_MS = TOKEN_TTL_MINUTES * 60 * 1000;

function resolveUserIdFromBody(body: Record<string, unknown>): string | null {
  const candidate =
    body["user_id"] ??
    body["userId"] ??
    body["phone"] ??
    body["mobile"] ??
    body["phone_number"];
  if (candidate && typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  return null;
}

function buildRedirectUrl(token: string): string | null {
  const origin =
    process.env["FORMS_REDIRECT_ORIGIN"] ??
    process.env["LEGACY_APP_ORIGIN"] ??
    "https://irp-dashboard-academy.replit.app";
  return `${origin.replace(/\/$/, "")}?auth_token=${token}`;
}

function checkApiKey(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const secret = process.env["TOKEN_SECRET"];
  if (!secret) return false;
  const authHeader = req.headers["authorization"];
  const bearer =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
  const apiKey = (req.headers["x-api-key"] as string) || bearer;
  return apiKey === secret;
}

function authCodeHandler(endpoint: string, withRedirect: boolean): RequestHandler {
  return async (req, res) => {
    const startedAt = Date.now();
    let userId: string | null = null;
    try {
      if (!checkApiKey(req as never)) {
        res.status(401).json({ message: "Unauthorized" });
        logAuthCodeEvent(req, { endpoint, outcome: "unauthorized", statusCode: 401, startedAt });
        return;
      }

      userId = resolveUserIdFromBody((req.body ?? {}) as Record<string, unknown>);
      if (!userId) {
        res.status(400).json({
          message: "user_id or phone is required",
          hint: "Send JSON with user_id, userId, or phone / mobile / phone_number",
        });
        logAuthCodeEvent(req, { endpoint, outcome: "missing_user", statusCode: 400, startedAt });
        return;
      }

      const { authToken, expiresAt, tokenId } = await createAuthToken(userId, TOKEN_TTL_MS);

      res.json({
        auth_token: authToken,
        expires_at: expiresAt.toISOString(),
        user_id: userId,
        ...(withRedirect ? { redirect_url: buildRedirectUrl(authToken) } : {}),
      });
      logAuthCodeEvent(req, { endpoint, outcome: "issued", statusCode: 200, startedAt, userId, tokenId });
    } catch (err) {
      req.log.error({ err }, `${endpoint} error`);
      res.status(500).json({ message: "Server error" });
      logAuthCodeEvent(req, { endpoint, outcome: "error", statusCode: 500, startedAt, userId, error: err });
    }
  };
}

// POST /api/auth/generate-auth-code
router.post("/auth/generate-auth-code", authCodeHandler("generate-auth-code", false));

// POST /api/auth/generate-auth-code-with-redirect
router.post(
  "/auth/generate-auth-code-with-redirect",
  authCodeHandler("generate-auth-code-with-redirect", true),
);

// GET /api/auth/me — verify the current SSO token and return the resolved user.
// Used by the dashboard right after the SSO redirect to confirm the session.
router.get("/auth/me", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      return void res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getAcademyUserBasicDetails(userId);

    res.json({
      userId,
      userName: resolveAcademyUserDisplayName(user),
      yog: user?.yog ?? null,
      profilePicUrl: sanitizeProfilePicUrl(user?.profilePicUrl) || null,
      paymentStatus: normalizePaymentStatusValue(user?.paymentStatus),
    });
  } catch (err) {
    req.log.error({ err }, "auth/me error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
