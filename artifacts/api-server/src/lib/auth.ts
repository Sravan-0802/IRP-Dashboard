import type { Request } from "express";
import { db, formsAuthTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Pulls the SSO auth token off the request. The token is accepted from, in
 * priority order: the `Authorization: Bearer` header, an `x-auth-token`
 * header, or an `auth_token` query param (used right after the SSO redirect).
 */
export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const headerToken = req.headers["x-auth-token"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }

  const queryToken = (req.query as Record<string, unknown> | undefined)?.["auth_token"];
  if (typeof queryToken === "string" && queryToken.trim()) {
    return queryToken.trim();
  }

  return null;
}

/**
 * Resolves the academy user_id for the current request by re-verifying the SSO
 * token against `forms_auth_tokens` on every call (no separate session). A
 * token is valid while it exists and has not expired.
 *
 * Outside production, `ACADEMY_USER_ID` in `.env` wins over browser SSO tokens
 * so you can preview different students without clearing sessionStorage.
 */
export async function resolveAcademyUserId(req: Request): Promise<string | null> {
  if (process.env["NODE_ENV"] !== "production") {
    const devUser = "afa8fbfa-1ae1-40e6-b0b8-2becd455a7b8";
    if (devUser) return devUser;
  }

  const token = extractAuthToken(req);

  if (token) {
    const [row] = await db
      .select()
      .from(formsAuthTokensTable)
      .where(eq(formsAuthTokensTable.token, token))
      .limit(1);

    if (row && row.expiresAt.getTime() > Date.now()) {
      return row.userId;
    }
    return null;
  }

  return null;
}
