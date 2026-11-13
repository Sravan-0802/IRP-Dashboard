/**
 * Dual-write (expand–contract step 3): after every BigQuery sync, refill the new irp_v2 tables from
 * the freshly synced old public.* tables, then compare old vs new (shadow check, step 4).
 *
 * Safety:
 *  - Does nothing unless schema irp_v2 already exists (it is created only by migrations-v2/run.mjs).
 *  - Turn off with env IRP_V2_SYNC=false.
 *  - One transaction: readers see the previous copy until COMMIT; on error it rolls back.
 *  - Only reads public.*; never changes the old tables. Never throws: failures are logged.
 *  - Must be switched off once the app writes to irp_v2 directly (step 6).
 */
import { pool } from "@workspace/db";
import { logger } from "./logger";
import resetSql from "../../../../lib/db/migrations-v2/04_refresh_reset.sql";
import copySql from "../../../../lib/db/migrations-v2/02_copy.sql";
import paritySql from "../../../../lib/db/migrations-v2/parity_old_dashboard.sql";
import verifySql from "../../../../lib/db/migrations-v2/03_verify.sql";

export interface IrpV2RefreshResult {
  status: "skipped" | "success" | "error";
  reason?: string;
  durationMs?: number;
  checks?: number;
  failedChecks?: {
    section: string;
    check: string;
    expected: string;
    actual: string;
  }[];
}

const stripSemicolon = (sql: string) => sql.trim().replace(/;\s*$/, "");

let refreshInProgress = false;

export async function refreshIrpV2(): Promise<IrpV2RefreshResult> {
  if (process.env["IRP_V2_SYNC"] === "false") {
    return { status: "skipped", reason: "IRP_V2_SYNC=false" };
  }
  if (refreshInProgress) {
    return { status: "skipped", reason: "refresh already in progress" };
  }
  refreshInProgress = true;
  const startedAt = new Date();
  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ exists: boolean }>(
        "SELECT to_regclass('irp_v2.mern_track') IS NOT NULL AS exists",
      );
      if (!rows[0]?.exists) {
        logger.info(
          "irp_v2 refresh skipped: schema irp_v2 not created on this database yet",
        );
        return { status: "skipped", reason: "schema irp_v2 does not exist" };
      }

      await client.query("SET statement_timeout = 0");
      await client.query("BEGIN");
      try {
        await client.query(resetSql);
        await client.query(copySql);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      }
      const durationMs = Date.now() - startedAt.getTime();

      // Shadow check: old dashboard results vs new tables, every student.
      await client.query("DROP TABLE IF EXISTS irp_v2.parity_old_dashboard");
      await client.query(
        `CREATE TABLE irp_v2.parity_old_dashboard AS\n${stripSemicolon(paritySql)}`,
      );
      const verify = await client.query<{
        section: string;
        check_name: string;
        expected: unknown;
        actual: unknown;
        result: string;
      }>(stripSemicolon(verifySql));
      const failedChecks = verify.rows
        .filter((r) => r.result === "FAIL")
        .map((r) => ({
          section: r.section,
          check: r.check_name,
          expected: String(r.expected),
          actual: String(r.actual),
        }));

      await client.query(
        `INSERT INTO irp_v2.sync_logs (job_name, direction, status, row_count, duration_ms, error_message, started_at, finished_at)
       VALUES ('irp_v2_refresh', 'PULL', $1, $2, $3, $4, $5, now())`,
        [
          failedChecks.length === 0 ? "success" : "checks_failed",
          verify.rows.length,
          durationMs,
          failedChecks.length === 0
            ? null
            : JSON.stringify(failedChecks).slice(0, 4000),
          startedAt,
        ],
      );

      if (failedChecks.length === 0) {
        logger.info(
          { durationMs, checks: verify.rows.length },
          "irp_v2 refresh done, all checks passed",
        );
      } else {
        logger.warn(
          { durationMs, failedChecks },
          "irp_v2 refresh done, some old-vs-new checks failed",
        );
      }
      return {
        status: "success",
        durationMs,
        checks: verify.rows.length,
        failedChecks,
      };
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error(
      { err },
      "irp_v2 refresh failed; the previous irp_v2 copy is unchanged",
    );
    return {
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    refreshInProgress = false;
  }
}
