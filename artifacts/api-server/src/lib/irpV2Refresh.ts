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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * The SQL lives in lib/db/migrations-v2 and is read from disk at run time, so this works however the
 * sync is started: the esbuild bundle (dist/index.mjs), tsx on the TypeScript source (the daily
 * scripts/daily-bq-sync.sh job), or the sync-now / run-sync scripts. Walks up from this file and from
 * the working directory until it finds the folder.
 */
export function findMigrationsDir(): string | null {
  const starts = [dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 8; i++) {
      const candidate = join(dir, "lib", "db", "migrations-v2");
      if (existsSync(join(candidate, "02_copy.sql"))) return candidate;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

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
  const migrationsDir = findMigrationsDir();
  if (!migrationsDir) {
    logger.warn("irp_v2 refresh skipped: lib/db/migrations-v2 not found next to the app");
    return { status: "skipped", reason: "migrations-v2 folder not found" };
  }
  const readSql = (name: string) => readFileSync(join(migrationsDir, name), "utf8");
  const resetSql = readSql("04_refresh_reset.sql");
  const copySql = readSql("02_copy.sql");
  const paritySql = readSql("parity_old_dashboard.sql");
  const verifySql = readSql("03_verify.sql");
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
