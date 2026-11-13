// Shared migration sequence for the IRP v2 data model.
// Used by run.mjs (Neon branch) and by the local rehearsal harness, so both run the same steps.
//
// `db` is a small adapter:
//   db.exec(sql)  -> run one or many statements, result ignored
//   db.query(sql) -> run ONE statement, resolve to an array of row objects
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), "utf8");

/** Adds the file name and line number to a Postgres error. */
function locate(err, file, sql) {
  const pos = Number(err?.position);
  if (Number.isFinite(pos) && pos > 0) {
    const line = sql.slice(0, pos - 1).split("\n").length;
    const context = sql.split("\n").slice(Math.max(0, line - 4), line + 3).join("\n");
    err.message = `${file}:${line}: ${err.message}\n--- near ---\n${context}\n------------`;
  } else {
    err.message = `${file}: ${err.message}`;
  }
  return err;
}

async function execFile(db, file) {
  const sql = read(file);
  try {
    await db.exec(sql);
  } catch (err) {
    throw locate(err, file, sql);
  }
}

/** Create the new tables and copy all data. One transaction: all or nothing. */
export async function migrate(db, log = console.log) {
  await db.exec("BEGIN");
  try {
    log("01_create.sql ...");
    await execFile(db, "01_create.sql");
    log("02_copy.sql ...");
    await execFile(db, "02_copy.sql");
    await db.exec("COMMIT");
    log("migrate: committed");
  } catch (err) {
    await db.exec("ROLLBACK");
    log("migrate: rolled back, nothing was changed");
    throw err;
  }
}

/**
 * Run the checks. Returns the check rows; `failed` is the count of FAIL rows.
 * parity_old_dashboard.sql (one SELECT) is materialised first so 03_verify.sql can join to it.
 */
export async function verify(db, log = console.log) {
  if (existsSync(join(here, "parity_old_dashboard.sql"))) {
    log("parity_old_dashboard.sql ...");
    const parity = read("parity_old_dashboard.sql").trim().replace(/;\s*$/, "");
    try {
      await db.exec("DROP TABLE IF EXISTS irp_v2.parity_old_dashboard");
      await db.exec(`CREATE TABLE irp_v2.parity_old_dashboard AS\n${parity}`);
    } catch (err) {
      throw locate(err, "parity_old_dashboard.sql", parity);
    }
  }
  log("03_verify.sql ...");
  const sql = read("03_verify.sql").trim().replace(/;\s*$/, "");
  let rows;
  try {
    rows = await db.query(sql);
  } catch (err) {
    throw locate(err, "03_verify.sql", sql);
  }
  const failed = rows.filter((r) => r.result === "FAIL").length;
  return { rows, failed };
}

/** Remove everything the migration created. Old tables are never touched. */
export async function rollback(db, log = console.log) {
  await execFile(db, "09_rollback.sql");
  log("rollback: schema irp_v2 dropped");
}
