import { db, pool, humanInterviewResultsTable, bigquerySyncStatusTable } from "@workspace/db";
import { eq, count, countDistinct } from "drizzle-orm";
import { fetchNexusInterviews, summarizeInterviews, interviewTimestamp, type InterviewAttempt } from "./humanInterviewData";

export const HUMAN_INTERVIEW_SYNC_TABLE = "human_interview_results";
let activeSync: Promise<void> | null = null;

export function isNexusConfigured(): boolean {
  return Boolean(process.env.STUDENT_PORTAL_API_KEY?.trim());
}

export async function getHumanInterviewSyncStatus() {
  const [status, counts] = await Promise.all([
    db.select().from(bigquerySyncStatusTable).where(eq(bigquerySyncStatusTable.tableName, HUMAN_INTERVIEW_SYNC_TABLE)).limit(1),
    db.select({ interviewCount: count(), studentCount: countDistinct(humanInterviewResultsTable.candidateId) }).from(humanInterviewResultsTable),
  ]);
  return {
    configured: isNexusConfigured(), running: activeSync !== null,
    syncedAt: status[0]?.lastSyncedAt?.toISOString() ?? null,
    interviewCount: Number(counts[0]?.interviewCount ?? 0),
    studentCount: Number(counts[0]?.studentCount ?? 0),
  };
}

export function syncHumanInterviews(): Promise<void> {
  if (activeSync) return activeSync;
  activeSync = performSync().finally(() => { activeSync = null; });
  return activeSync;
}

async function performSync(): Promise<void> {
  const apiKey = process.env.STUDENT_PORTAL_API_KEY?.trim();
  if (!apiKey) throw new Error("Academy Nexus key is not configured");
  const started = Date.now();
  // Cross-process lock prevents overlapping fetches from overwriting a newer snapshot.
  const lock = await pool.connect();
  let locked = false;
  try {
    const result = await lock.query("SELECT pg_try_advisory_lock(731240991) AS acquired");
    locked = result.rows[0]?.acquired === true;
    if (!locked) throw new Error("An interview sync is already running; please try again shortly");
    const rows = await fetchNexusInterviews(apiKey);
    const syncedAt = new Date();
    // Replace only after EVERY page has been fetched and validated. Failure rolls back.
    await db.transaction(async (tx) => {
      await tx.delete(humanInterviewResultsTable);
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(humanInterviewResultsTable).values(rows.slice(i, i + 500).map((r) => ({
          ...r, syncedAt,
          interviewStartsAt: interviewTimestamp(r) >= 0 ? new Date(interviewTimestamp(r)) : null,
        })));
      }
      const status = {
        status: "success", rowCount: rows.length, durationMs: Date.now() - started,
        error: null, lastSyncedAt: syncedAt, updatedAt: syncedAt,
      };
      await tx.insert(bigquerySyncStatusTable).values({ tableName: HUMAN_INTERVIEW_SYNC_TABLE, ...status })
        .onConflictDoUpdate({ target: bigquerySyncStatusTable.tableName, set: status });
    });
  } finally {
    try {
      if (locked) await lock.query("SELECT pg_advisory_unlock(731240991)");
    } finally {
      lock.release();
    }
  }
}

export async function getHumanInterviewsForUser(candidateId: string) {
  const [rows, status] = await Promise.all([
    db.select().from(humanInterviewResultsTable).where(eq(humanInterviewResultsTable.candidateId, candidateId)),
    db.select({ syncedAt: bigquerySyncStatusTable.lastSyncedAt }).from(bigquerySyncStatusTable)
      .where(eq(bigquerySyncStatusTable.tableName, HUMAN_INTERVIEW_SYNC_TABLE)).limit(1),
  ]);
  const publicRows: InterviewAttempt[] = rows.map(({ candidateId: _uid, syncedAt: _syncedAt, interviewStartsAt: _start, ...attempt }) => attempt);
  return { ...summarizeInterviews(publicRows), syncedAt: status[0]?.syncedAt?.toISOString() ?? null };
}

export async function getHumanInterviewStats() {
  const result = await db.select({
    clearanceStatus: humanInterviewResultsTable.clearanceStatus,
    count: countDistinct(humanInterviewResultsTable.candidateId),
  }).from(humanInterviewResultsTable).groupBy(humanInterviewResultsTable.clearanceStatus);

  const stats = {
    cleared: 0,
    notCleared: 0,
    neverCompleted: 0,
    totalStudents: 0,
  };

  for (const row of result) {
    const status = row.clearanceStatus?.trim().toLowerCase() || "";
    const count = Number(row.count) || 0;
    stats.totalStudents += count;

    if (status === "cleared") stats.cleared = count;
    else if (status === "not cleared") stats.notCleared = count;
    else stats.neverCompleted += count;
  }

  return stats;
}
