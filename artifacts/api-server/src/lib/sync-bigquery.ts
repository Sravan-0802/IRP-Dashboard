import { sql } from "drizzle-orm";
import {
  db,
  academyUserBasicDetailsTable,
  academyUserCourseProgressTable,
  bigquerySyncStatusTable,
} from "@workspace/db";
import { logger } from "./logger";
import {
  fetchBasicDetails,
  fetchCourseProgress,
  isBigQueryConfigured,
} from "./bigquery";

const BASIC_DETAILS_KEY = "academy_user_basic_details";
const COURSE_PROGRESS_KEY = "academy_user_course_progress";
const BATCH_SIZE = 500;

function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toReal(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

async function recordStatus(
  tableName: string,
  status: "success" | "error",
  rowCount: number,
  durationMs: number,
  error: string | null
): Promise<void> {
  const now = new Date();
  await db
    .insert(bigquerySyncStatusTable)
    .values({
      tableName,
      status,
      rowCount,
      durationMs,
      error,
      lastSyncedAt: status === "success" ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: bigquerySyncStatusTable.tableName,
      set: {
        status,
        rowCount,
        durationMs,
        error,
        ...(status === "success" ? { lastSyncedAt: now } : {}),
        updatedAt: now,
      },
    });
}

async function syncBasicDetails(): Promise<number> {
  const rows = await fetchBasicDetails();
  const mapped = rows
    .filter((r) => r.user_id != null && String(r.user_id).trim() !== "")
    .map((r) => ({
      userId: String(r.user_id),
      userName: toStr(r.user_name),
      syncedAt: new Date(),
    }));

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    await db
      .insert(academyUserBasicDetailsTable)
      .values(batch)
      .onConflictDoUpdate({
        target: academyUserBasicDetailsTable.userId,
        set: {
          userName: sql`excluded.user_name`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return mapped.length;
}

async function syncCourseProgress(): Promise<number> {
  const rows = await fetchCourseProgress();
  const mapped = rows
    .filter(
      (r) =>
        r.user_id != null &&
        String(r.user_id).trim() !== "" &&
        r.course_id != null &&
        String(r.course_id).trim() !== ""
    )
    .map((r) => ({
      userId: String(r.user_id),
      courseId: String(r.course_id),
      courseTitle: toStr(r.course_title),
      mcqsCompleted: toInt(r.mcqs_completed),
      totalMcqs: toInt(r.total_mcqs),
      mcqCompletionPct: toReal(r.mcq_completion_pct),
      codingProblemsCompleted: toInt(r.coding_problems_completed),
      totalCodingProblems: toInt(r.total_coding_problems),
      codingCompletionPct: toReal(r.coding_completion_pct),
      overallCompleted: toInt(r.overall_completed),
      overallTotal: toInt(r.overall_total),
      overallCompletionPct: toReal(r.overall_completion_pct),
      syncedAt: new Date(),
    }));

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    await db
      .insert(academyUserCourseProgressTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          academyUserCourseProgressTable.userId,
          academyUserCourseProgressTable.courseId,
        ],
        set: {
          courseTitle: sql`excluded.course_title`,
          mcqsCompleted: sql`excluded.mcqs_completed`,
          totalMcqs: sql`excluded.total_mcqs`,
          mcqCompletionPct: sql`excluded.mcq_completion_pct`,
          codingProblemsCompleted: sql`excluded.coding_problems_completed`,
          totalCodingProblems: sql`excluded.total_coding_problems`,
          codingCompletionPct: sql`excluded.coding_completion_pct`,
          overallCompleted: sql`excluded.overall_completed`,
          overallTotal: sql`excluded.overall_total`,
          overallCompletionPct: sql`excluded.overall_completion_pct`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return mapped.length;
}

async function runOne(
  key: string,
  fn: () => Promise<number>
): Promise<{ table: string; status: "success" | "error"; rowCount: number; error?: string }> {
  const start = Date.now();
  try {
    const rowCount = await fn();
    const durationMs = Date.now() - start;
    await recordStatus(key, "success", rowCount, durationMs, null);
    logger.info({ table: key, rowCount, durationMs }, "BigQuery sync completed");
    return { table: key, status: "success", rowCount };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    await recordStatus(key, "error", 0, durationMs, message).catch(() => {});
    logger.error({ table: key, err }, "BigQuery sync failed");
    return { table: key, status: "error", rowCount: 0, error: message };
  }
}

export interface SyncResult {
  ok: boolean;
  results: Array<{ table: string; status: "success" | "error"; rowCount: number; error?: string }>;
}

let syncInProgress = false;

/**
 * Pulls both IRP tables from BigQuery and upserts them into Postgres.
 * Each table is tracked independently so one failure does not block the other.
 */
export async function runBigQuerySync(): Promise<SyncResult> {
  if (!isBigQueryConfigured()) {
    logger.warn("Skipping BigQuery sync: service account env vars not configured");
    return {
      ok: false,
      results: [
        { table: "all", status: "error", rowCount: 0, error: "BigQuery not configured" },
      ],
    };
  }

  if (syncInProgress) {
    return {
      ok: false,
      results: [{ table: "all", status: "error", rowCount: 0, error: "Sync already in progress" }],
    };
  }

  syncInProgress = true;
  try {
    const results = [
      await runOne(BASIC_DETAILS_KEY, syncBasicDetails),
      await runOne(COURSE_PROGRESS_KEY, syncCourseProgress),
    ];
    return { ok: results.every((r) => r.status === "success"), results };
  } finally {
    syncInProgress = false;
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Schedules the sync to run on an interval (default 60 min, override with
 * BQ_SYNC_INTERVAL_MINUTES). Runs once shortly after startup. Failures are
 * logged but never crash the server (expected while VPC access is pending).
 */
export function startBigQuerySyncScheduler(): void {
  if (!isBigQueryConfigured()) {
    logger.warn("BigQuery sync scheduler not started: service account not configured");
    return;
  }

  const minutes = Number(process.env["BQ_SYNC_INTERVAL_MINUTES"] ?? "60");
  const intervalMs = Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 60 * 60 * 1000;

  // Initial run shortly after boot, off the critical startup path.
  setTimeout(() => {
    runBigQuerySync().catch((err) => logger.error({ err }, "Initial BigQuery sync errored"));
  }, 10_000);

  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(() => {
    runBigQuerySync().catch((err) => logger.error({ err }, "Scheduled BigQuery sync errored"));
  }, intervalMs);

  logger.info({ intervalMinutes: intervalMs / 60000 }, "BigQuery sync scheduler started");
}
