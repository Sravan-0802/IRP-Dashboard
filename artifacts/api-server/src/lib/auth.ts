import type { Request } from "express";
import { db, formsAuthTokensTable, blockedUsersTable } from "@workspace/db";
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
 *
 * Users in the `blocked_users` table are always treated as logged out — null is
 * returned regardless of how they authenticated or what env overrides are set.
 */
export async function resolveAcademyUserId(req: Request): Promise<string | null> {
  const userId = await resolveAcademyUserIdUnchecked(req);
  if (!userId) return null;

  const [blocked] = await db
    .select({ academyUserId: blockedUsersTable.academyUserId })
    .from(blockedUsersTable)
    .where(eq(blockedUsersTable.academyUserId, userId))
    .limit(1);
  if (blocked) return null;

  return userId;
}

async function resolveAcademyUserIdUnchecked(req: Request): Promise<string | null> {
  if (process.env["NODE_ENV"] !== "production") {
    const devUser = process.env["ACADEMY_USER_ID"]?.trim();
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
