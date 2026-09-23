import crypto from "node:crypto";
import { db, formsAuthTokensTable } from "@workspace/db";

const MAX_INSERT_ATTEMPTS = 3;

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
};

function errorChain(error: unknown): ErrorLike[] {
  const chain: ErrorLike[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const value = current as ErrorLike;
    chain.push(value);
    current = value.cause;
  }

  return chain;
}

function isTransientDatabaseError(error: unknown): boolean {
  const chain = errorChain(error);
  const codes = new Set(
    chain
      .map((value) => (typeof value.code === "string" ? value.code : ""))
      .filter(Boolean),
  );
  const messages = chain
    .map((value) => (typeof value.message === "string" ? value.message : ""))
    .filter(Boolean)
    .join(" ");

  return (
    [...codes].some((code) => code.startsWith("08") || code === "57P01") ||
    /terminating connection due to administrator command|connection terminated unexpectedly|connection reset|connection refused|ECONNRESET/i.test(
      messages,
    )
  );
}

function waitBeforeRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
}

export async function createAuthToken(
  userId: string,
  ttlMs: number,
): Promise<{ authToken: string; expiresAt: Date }> {
  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt += 1) {
    const authToken = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + ttlMs);

    try {
      await db.insert(formsAuthTokensTable).values({
        token: authToken,
        userId,
        expiresAt,
        used: 0,
      });

      return { authToken, expiresAt };
    } catch (error) {
      if (!isTransientDatabaseError(error) || attempt === MAX_INSERT_ATTEMPTS - 1) {
        throw error;
      }

      await waitBeforeRetry(attempt);
    }
  }

  throw new Error("Unable to create authentication token");
}