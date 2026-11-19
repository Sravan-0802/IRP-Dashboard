import { db, pool, genaiHumanInterviewResultsTable, bigquerySyncStatusTable } from "@workspace/db";
import { eq, count, countDistinct, sql } from "drizzle-orm";
import { interviewTimestamp } from "./humanInterviewData";
import { fetchGenaiNexusInterviews, summarizeGenaiInterviews, type GenaiInterviewAttempt } from "./genaiHumanInterviewData";
import { isNexusConfigured } from "./humanInterviews";

export const GENAI_HUMAN_INTERVIEW_SYNC_TABLE = "genai_human_interview_results";
// Separate lock from the MERN (irp-l1) sync so both can run independently.
const GENAI_SYNC_LOCK_ID = 731240992;
let activeSync: Promise<void> | null = null;

export async function getGenaiHumanInterviewSyncStatus() {
  const [status, counts] = await Promise.all([
    db.select().from(bigquerySyncStatusTable)
      .where(eq(bigquerySyncStatusTable.tableName, GENAI_HUMAN_INTERVIEW_SYNC_TABLE)).limit(1),
    db.select({
      interviewCount: count(),
      studentCount: countDistinct(genaiHumanInterviewResultsTable.candidateId),
    }).from(genaiHumanInterviewResultsTable),
  ]);
  return {
    configured: isNexusConfigured(), running: activeSync !== null,
    syncedAt: status[0]?.lastSyncedAt?.toISOString() ?? null,
    interviewCount: Number(counts[0]?.interviewCount ?? 0),
    studentCount: Number(counts[0]?.studentCount ?? 0),
  };
}

export function syncGenaiHumanInterviews(): Promise<void> {
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
    const result = await lock.query("SELECT pg_try_advisory_lock($1) AS acquired", [GENAI_SYNC_LOCK_ID]);
    locked = result.rows[0]?.acquired === true;
    if (!locked) throw new Error("A GenAI interview sync is already running; please try again shortly");
    const rows = await fetchGenaiNexusInterviews(apiKey);
    const syncedAt = new Date();
    // Replace only after EVERY page has been fetched and validated. Failure rolls back.
    await db.transaction(async (tx) => {
      await tx.delete(genaiHumanInterviewResultsTable);
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(genaiHumanInterviewResultsTable).values(rows.slice(i, i + 500).map((r) => ({
          ...r, syncedAt,
          interviewStartsAt: interviewTimestamp(r) >= 0 ? new Date(interviewTimestamp(r)) : null,
        })));
      }
      const status = {
        status: "success", rowCount: rows.length, durationMs: Date.now() - started,
        error: null, lastSyncedAt: syncedAt, updatedAt: syncedAt,
      };
      await tx.insert(bigquerySyncStatusTable).values({ tableName: GENAI_HUMAN_INTERVIEW_SYNC_TABLE, ...status })
        .onConflictDoUpdate({ target: bigquerySyncStatusTable.tableName, set: status });
    });
  } finally {
    try {
      if (locked) await lock.query("SELECT pg_advisory_unlock($1)", [GENAI_SYNC_LOCK_ID]);
    } finally {
      lock.release();
    }
  }
}

export async function getGenaiHumanInterviewsForUser(candidateId: string) {
  const [rows, status] = await Promise.all([
    db.select().from(genaiHumanInterviewResultsTable)
      .where(eq(genaiHumanInterviewResultsTable.candidateId, candidateId)),
    db.select({ syncedAt: bigquerySyncStatusTable.lastSyncedAt }).from(bigquerySyncStatusTable)
      .where(eq(bigquerySyncStatusTable.tableName, GENAI_HUMAN_INTERVIEW_SYNC_TABLE)).limit(1),
  ]);
  const publicRows: GenaiInterviewAttempt[] = rows.map(
    ({ candidateId: _uid, syncedAt: _syncedAt, interviewStartsAt: _start, ...attempt }) => attempt,
  );
  return { ...summarizeGenaiInterviews(publicRows), syncedAt: status[0]?.syncedAt?.toISOString() ?? null };
}

/** Per student, by the latest scored attempt (same rule the student dashboard uses). */
export async function getGenaiHumanInterviewStats() {
  const result = await db.execute(sql`
    WITH scored AS (
      SELECT DISTINCT ON (candidate_id) candidate_id, clearance_status
      FROM genai_human_interview_results
      WHERE final_score IS NOT NULL AND clearance_status IN ('Cleared', 'Not Cleared')
      ORDER BY candidate_id, interview_starts_at DESC NULLS LAST, interview_id ASC
    ), everyone AS (
      SELECT COUNT(DISTINCT candidate_id)::int AS total FROM genai_human_interview_results
    )
    SELECT
      COUNT(*) FILTER (WHERE clearance_status = 'Cleared')::int AS cleared,
      COUNT(*) FILTER (WHERE clearance_status = 'Not Cleared')::int AS not_cleared,
      (SELECT total FROM everyone) AS total
    FROM scored
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<
    { cleared?: number; not_cleared?: number; total?: number }
  >;
  const row = rows[0] ?? {};
  const cleared = Number(row.cleared ?? 0);
  const notCleared = Number(row.not_cleared ?? 0);
  const totalStudents = Number(row.total ?? 0);
  return { cleared, notCleared, neverCompleted: Math.max(0, totalStudents - cleared - notCleared), totalStudents };
}
