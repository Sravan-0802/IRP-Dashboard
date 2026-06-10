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

function dedupeByKey<T>(rows: T[], keyFn: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(keyFn(row), row);
  return [...map.values()];
}

async function syncBasicDetails(): Promise<number> {
  const rows = await fetchBasicDetails();
  const mapped = dedupeByKey(
    rows
      .filter((r) => r.user_id != null && String(r.user_id).trim() !== "")
      .map((r) => ({
        userId: String(r.user_id),
        userName: toStr(r.user_name),
        syncedAt: new Date(),
      })),
    (r) => r.userId,
  );

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
  const mapped = dedupeByKey(
    rows
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
      })),
    (r) => `${r.userId}:${r.courseId}`,
  );

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

let nextRunHandle: ReturnType<typeof setTimeout> | null = null;

const IST_OFFSET_MINUTES = 5 * 60 + 30; // Asia/Kolkata is UTC+05:30 (no DST)
const MINUTES_PER_DAY = 24 * 60;

/**
 * Parses the configured daily sync times (IST) into minutes-of-day in UTC.
 * Override with BQ_SYNC_TIMES_IST, e.g. "10:00,18:00". Defaults to 10:00 & 18:00 IST.
 */
function getSyncTargetsUtcMinutes(): number[] {
  const raw = process.env["BQ_SYNC_TIMES_IST"]?.trim();
  const items = (raw ? raw.split(",") : ["10:00", "18:00"])
    .map((s) => s.trim())
    .filter(Boolean);

  const targets: number[] = [];
  for (const item of items) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(item);
    if (!m) continue;
    const hours = Number(m[1]);
    const mins = Number(m[2]);
    if (hours > 23 || mins > 59) continue;
    const utc = (((hours * 60 + mins - IST_OFFSET_MINUTES) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    targets.push(utc);
  }

  const unique = [...new Set(targets)].sort((a, b) => a - b);
  // Fallback to 10:00 & 18:00 IST if config was empty/invalid.
  return unique.length ? unique : [(10 * 60 - IST_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY, (18 * 60 - IST_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY].sort((a, b) => a - b);
}

function msUntilNextTarget(targetsUtcMinutes: number[]): number {
  const now = new Date();
  const nowMinOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
  const nowSec = now.getUTCSeconds();

  for (const target of targetsUtcMinutes) {
    const deltaMin = target - nowMinOfDay;
    if (deltaMin > 0) {
      return (deltaMin * 60 - nowSec) * 1000;
    }
  }
  // All targets already passed today — schedule the first one tomorrow.
  const minsUntilMidnight = MINUTES_PER_DAY - nowMinOfDay;
  return ((minsUntilMidnight + targetsUtcMinutes[0]) * 60 - nowSec) * 1000;
}

/**
 * Schedules the sync to run at fixed daily times (default 10:00 & 18:00 IST,
 * override with BQ_SYNC_TIMES_IST). Runs once shortly after startup unless
 * BQ_SYNC_ON_BOOT is "false". Failures are logged but never crash the server.
 */
export function startBigQuerySyncScheduler(): void {
  if (!isBigQueryConfigured()) {
    logger.warn("BigQuery sync scheduler not started: service account not configured");
    return;
  }

  const targets = getSyncTargetsUtcMinutes();

  if (process.env["BQ_SYNC_ON_BOOT"] !== "false") {
    // Initial run shortly after boot, off the critical startup path.
    setTimeout(() => {
      runBigQuerySync().catch((err) => logger.error({ err }, "Initial BigQuery sync errored"));
    }, 10_000);
  }

  const scheduleNext = () => {
    const delay = msUntilNextTarget(targets);
    const nextRunAt = new Date(Date.now() + delay).toISOString();
    if (nextRunHandle) clearTimeout(nextRunHandle);
    nextRunHandle = setTimeout(() => {
      runBigQuerySync()
        .catch((err) => logger.error({ err }, "Scheduled BigQuery sync errored"))
        .finally(scheduleNext);
    }, delay);
    logger.info({ nextRunAt, minutesUntil: Math.round(delay / 60000) }, "Next BigQuery sync scheduled");
  };

  scheduleNext();

  const istTimes = targets.map((t) => {
    const ist = (t + IST_OFFSET_MINUTES) % MINUTES_PER_DAY;
    return `${String(Math.floor(ist / 60)).padStart(2, "0")}:${String(ist % 60).padStart(2, "0")}`;
  });
  logger.info({ syncTimesIST: istTimes }, "BigQuery sync scheduler started (daily, IST)");
}
