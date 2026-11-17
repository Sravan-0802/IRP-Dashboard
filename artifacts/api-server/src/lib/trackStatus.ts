/**
 * Read a student's MERN stage results from irp_v2.mern_track (expand–contract step 5).
 *
 * Off unless env IRP_V2_READ=true. Even when on, the old logic is kept (source "legacy") whenever the
 * new tables cannot be trusted or reached: last refresh failed its checks, refresh is stale, the
 * student has no row, or the query is slow or errors. The daily refresh holds a lock on the irp_v2
 * tables for ~15 s while it refills them, so the read has a short timeout instead of waiting.
 */
import { pool } from "@workspace/db";
import { logger } from "./logger";
import {
  legacy,
  toTrackStatusResponse,
  type TrackStatusResponse,
  type TrackStatusRow,
} from "./trackStatusData";

export function isV2ReadEnabled(): boolean {
  return process.env["IRP_V2_READ"] === "true";
}

export const TRACK_STATUS_SQL = `
SELECT r.status      AS refresh_status,
       r.finished_at AS refresh_finished_at,
       m.hustler_assessment_status,
       m.fe_project_status,
       m.human_interview_status,
       m.calculated_at
FROM (SELECT status, finished_at
      FROM irp_v2.sync_logs
      WHERE job_name = 'irp_v2_refresh'
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 1) r
LEFT JOIN irp_v2.mern_track m ON m.user_id = $1`;

const READ_TIMEOUT_MS = 1500;

export type TrackStatusQuery = (userId: string) => Promise<TrackStatusRow | undefined>;

const queryWithTimeout: TrackStatusQuery = async (userId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query(`SET LOCAL statement_timeout = ${READ_TIMEOUT_MS}`);
    const { rows } = await client.query<TrackStatusRow>(TRACK_STATUS_SQL, [userId]);
    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/** Never throws: any failure means "use the old logic". */
export async function readMernTrackStatus(
  userId: string,
  opts: { humanInterviewReleased: boolean },
  runQuery: TrackStatusQuery = queryWithTimeout,
): Promise<TrackStatusResponse> {
  if (!isV2ReadEnabled()) return legacy("disabled");
  try {
    const row = await runQuery(userId);
    return toTrackStatusResponse(row, {
      humanInterviewReleased: opts.humanInterviewReleased,
      now: Date.now(),
    });
  } catch (err) {
    logger.warn({ err }, "irp_v2 track status unavailable; using the old logic");
    return legacy("unavailable");
  }
}
