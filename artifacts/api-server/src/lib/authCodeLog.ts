import type { Request } from "express";
import { db, authCodeLogsTable, academyUserBasicDetailsTable } from "@workspace/db";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { logger } from "./logger";

export const AUTH_CODE_OUTCOMES = [
  "issued",
  "missing_user",
  "unauthorized",
  "invalid_json",
  "error",
] as const;
export type AuthCodeOutcome = (typeof AUTH_CODE_OUTCOMES)[number];

const RETENTION_DAYS = 90;

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS auth_code_logs (
  id serial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  outcome text NOT NULL,
  status_code integer NOT NULL,
  user_id text,
  user_known integer,
  token_id integer,
  body_keys text,
  caller_ip text,
  user_agent text,
  request_id text,
  duration_ms integer,
  error text
);
CREATE INDEX IF NOT EXISTS auth_code_logs_created_at_idx ON auth_code_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS auth_code_logs_user_id_idx ON auth_code_logs (user_id);
`;

let ensurePromise: Promise<void> | null = null;
let lastPruneAt = 0;

async function ensureTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = db
      .execute(sql.raw(ENSURE_SQL))
      .then(() => undefined)
      .catch((err) => {
        ensurePromise = null;
        throw err;
      });
  }
  await ensurePromise;
}

async function pruneOldLogs(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < 24 * 60 * 60 * 1000) return;
  lastPruneAt = now;
  const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(authCodeLogsTable).where(lt(authCodeLogsTable.createdAt, cutoff));
}

function callerIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.ip || null;
}

function bodyKeys(req: Request): string | null {
  const body = req.body as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = Object.keys(body as Record<string, unknown>).slice(0, 20);
  return keys.length ? keys.join(",").slice(0, 300) : null;
}

async function isKnownUser(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: academyUserBasicDetailsTable.userId })
    .from(academyUserBasicDetailsTable)
    .where(eq(academyUserBasicDetailsTable.userId, userId))
    .limit(1);
  return Boolean(row);
}

/**
 * Records one auth-code request. Never throws and never delays the response:
 * call it after the response is sent.
 */
export function logAuthCodeEvent(
  req: Request,
  event: {
    endpoint: string;
    outcome: AuthCodeOutcome;
    statusCode: number;
    startedAt: number;
    userId?: string | null;
    tokenId?: number | null;
    error?: unknown;
  },
): void {
  const durationMs = Date.now() - event.startedAt;
  const errorText =
    event.error == null
      ? null
      : (event.error instanceof Error ? event.error.message : String(event.error)).slice(0, 500);
  const logLine = {
    authCode: {
      endpoint: event.endpoint,
      outcome: event.outcome,
      statusCode: event.statusCode,
      userId: event.userId ?? null,
      durationMs,
    },
  };
  if (event.outcome === "error") logger.error({ ...logLine, err: event.error }, "Auth code request failed");
  else logger.info(logLine, "Auth code request");

  void (async () => {
    await ensureTable();
    const userKnown = event.userId ? ((await isKnownUser(event.userId)) ? 1 : 0) : null;
    await db.insert(authCodeLogsTable).values({
      endpoint: event.endpoint,
      outcome: event.outcome,
      statusCode: event.statusCode,
      userId: event.userId ?? null,
      userKnown,
      tokenId: event.tokenId ?? null,
      bodyKeys: bodyKeys(req),
      callerIp: callerIp(req),
      userAgent: (req.headers["user-agent"] ?? "").toString().slice(0, 300) || null,
      requestId: req.id != null ? String(req.id) : null,
      durationMs,
      error: errorText,
    });
    await pruneOldLogs();
  })().catch((err) => logger.warn({ err }, "Could not write auth code log"));
}

export type AuthCodeLogRow = {
  id: number;
  createdAt: string;
  endpoint: string;
  outcome: string;
  statusCode: number;
  userId: string | null;
  userKnown: boolean | null;
  tokenId: number | null;
  bodyKeys: string | null;
  callerIp: string | null;
  userAgent: string | null;
  requestId: string | null;
  durationMs: number | null;
  error: string | null;
};

export async function listAuthCodeLogs(filters: {
  outcome?: string | null;
  userId?: string | null;
  limit?: number;
}): Promise<{
  logs: AuthCodeLogRow[];
  summary: { last24h: Record<string, number>; last7d: Record<string, number> };
}> {
  await ensureTable();
  const where = [];
  if (filters.outcome && (AUTH_CODE_OUTCOMES as readonly string[]).includes(filters.outcome)) {
    where.push(eq(authCodeLogsTable.outcome, filters.outcome));
  }
  if (filters.userId?.trim()) where.push(eq(authCodeLogsTable.userId, filters.userId.trim()));
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 1000);

  const rows = await db
    .select()
    .from(authCodeLogsTable)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(authCodeLogsTable.createdAt))
    .limit(limit);

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const counts = await db
    .select({
      outcome: authCodeLogsTable.outcome,
      last7d: sql<number>`count(*)::int`,
      last24h: sql<number>`count(*) filter (where ${authCodeLogsTable.createdAt} >= ${since24h})::int`,
    })
    .from(authCodeLogsTable)
    .where(gte(authCodeLogsTable.createdAt, since7d))
    .groupBy(authCodeLogsTable.outcome);

  const last24h: Record<string, number> = {};
  const last7d: Record<string, number> = {};
  for (const outcome of AUTH_CODE_OUTCOMES) {
    last24h[outcome] = 0;
    last7d[outcome] = 0;
  }
  for (const c of counts) {
    last24h[c.outcome] = Number(c.last24h);
    last7d[c.outcome] = Number(c.last7d);
  }

  return {
    logs: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      endpoint: r.endpoint,
      outcome: r.outcome,
      statusCode: r.statusCode,
      userId: r.userId,
      userKnown: r.userKnown == null ? null : r.userKnown === 1,
      tokenId: r.tokenId,
      bodyKeys: r.bodyKeys,
      callerIp: r.callerIp,
      userAgent: r.userAgent,
      requestId: r.requestId,
      durationMs: r.durationMs,
      error: r.error,
    })),
    summary: { last24h, last7d },
  };
}
