import { Router } from "express";
import crypto from "crypto";
import { db, formsAuthTokensTable, academyUserBasicDetailsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveAcademyUserId } from "../lib/auth";

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
    process.env["FORMS_REDIRECT_ORIGIN"] ?? process.env["LEGACY_APP_ORIGIN"];
  if (!origin) return null;
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

// POST /api/auth/generate-auth-code
router.post("/auth/generate-auth-code", async (req, res) => {
  try {
    if (!checkApiKey(req as never)) {
      return void res.status(401).json({ message: "Unauthorized" });
    }

    const userId = resolveUserIdFromBody(req.body as Record<string, unknown>);
    if (!userId) {
      return void res.status(400).json({
        message: "user_id or phone is required",
        hint: "Send JSON with user_id, userId, or phone / mobile / phone_number",
      });
    }

    const authToken = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await db.insert(formsAuthTokensTable).values({
      token: authToken,
      userId,
      expiresAt,
      used: 0,
    });

    res.json({
      auth_token: authToken,
      expires_at: expiresAt.toISOString(),
      user_id: userId,
    });
  } catch (err) {
    req.log.error({ err }, "generate-auth-code error");
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/generate-auth-code-with-redirect
router.post("/auth/generate-auth-code-with-redirect", async (req, res) => {
  try {
    if (!checkApiKey(req as never)) {
      return void res.status(401).json({ message: "Unauthorized" });
    }

    const userId = resolveUserIdFromBody(req.body as Record<string, unknown>);
    if (!userId) {
      return void res.status(400).json({
        message: "user_id or phone is required",
        hint: "Send JSON with user_id, userId, or phone / mobile / phone_number",
      });
    }

    const authToken = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await db.insert(formsAuthTokensTable).values({
      token: authToken,
      userId,
      expiresAt,
      used: 0,
    });

    const redirect_url = buildRedirectUrl(authToken);
    if (!redirect_url) {
      return void res.status(500).json({
        message: "Missing or invalid FORMS_REDIRECT_ORIGIN / LEGACY_APP_ORIGIN env var",
        auth_token: authToken,
        expires_at: expiresAt.toISOString(),
        user_id: userId,
      });
    }

    res.json({
      auth_token: authToken,
      expires_at: expiresAt.toISOString(),
      user_id: userId,
      redirect_url,
    });
  } catch (err) {
    req.log.error({ err }, "generate-auth-code-with-redirect error");
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/me — verify the current SSO token and return the resolved user.
// Used by the dashboard right after the SSO redirect to confirm the session.
router.get("/auth/me", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      return void res.status(401).json({ message: "Unauthorized" });
    }

    const [user] = await db
      .select()
      .from(academyUserBasicDetailsTable)
      .where(eq(academyUserBasicDetailsTable.userId, userId))
      .limit(1);

    res.json({ userId, userName: user?.userName ?? null });
  } catch (err) {
    req.log.error({ err }, "auth/me error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
