// run.mjs — runs the IRP v2 migration against a Neon BRANCH (never production).
//
//   cd lib/db
//   node --env-file=../../.env migrations-v2/run.mjs            # migrate + checks
//   node --env-file=../../.env migrations-v2/run.mjs verify     # checks only
//   node --env-file=../../.env migrations-v2/run.mjs rollback   # drop schema irp_v2 (old tables untouched)
//   add --fresh to "migrate" to drop an earlier irp_v2 first
//
// Connection: MIGRATION_DATABASE_URL (a Neon branch). The script refuses to run when that host is the
// production endpoint or the same host as DATABASE_URL. The connection string is never printed.
import pg from "pg";
import { migrate, verify, rollback } from "./steps.mjs";

const PRODUCTION_ENDPOINTS = ["ep-misty-math-azh5hyws"];

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("--")) ?? "migrate";
const fresh = args.includes("--fresh");
const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s] ${msg}`);

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// --use-database-url: run against the app's own DATABASE_URL (the Replit database). Only with the
// owner's explicit approval; the migration is additive (new schema irp_v2) and reads public.* only.
const useAppDb = args.includes("--use-database-url");
const url = useAppDb ? process.env.DATABASE_URL : process.env.MIGRATION_DATABASE_URL;
const host = url ? hostOf(url) : null;
if (!host) {
  console.error(useAppDb
    ? "DATABASE_URL is missing or not a valid postgres URL."
    : "MIGRATION_DATABASE_URL is missing or not a valid postgres URL. Add the Neon BRANCH connection string to .env.");
  process.exit(2);
}
const prodHost = process.env.DATABASE_URL ? hostOf(process.env.DATABASE_URL) : null;
const stripPooler = (h) => h.replace("-pooler.", ".");
if (!useAppDb && (PRODUCTION_ENDPOINTS.some((ep) => host.includes(ep)) || (prodHost && stripPooler(prodHost) === stripPooler(host)))) {
  console.error("Refusing to run: MIGRATION_DATABASE_URL points at the PRODUCTION database. Use a Neon branch.");
  process.exit(2);
}
if (!["migrate", "verify", "rollback"].includes(command)) {
  console.error(`Unknown command "${command}". Use migrate, verify or rollback.`);
  process.exit(2);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
const db = {
  exec: async (sql) => { await client.query(sql); },
  query: async (sql) => (await client.query(sql)).rows,
};

let exitCode = 0;
try {
  await client.connect();
  await client.query("SET statement_timeout = 0");
  const [{ endpoint }] = await db.query("SELECT split_part(current_setting('neon.endpoint_id', true), '.', 1) AS endpoint");
  log(`connected to branch endpoint ${endpoint || host.split(".")[0]}`);

  if (command === "rollback") {
    await rollback(db, log);
  } else {
    if (command === "migrate") {
      const [{ exists }] = await db.query("SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'irp_v2') AS exists");
      if (exists && !fresh) {
        console.error("Schema irp_v2 already exists on this branch. Re-run with --fresh to rebuild it, or run 'verify'.");
        process.exit(2);
      }
      if (exists) await rollback(db, log);
      await migrate(db, log);
      for (const r of await db.query(
        `SELECT c.relname AS table_name, c.reltuples::bigint AS approx_rows
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'irp_v2' AND c.relkind = 'r' ORDER BY 1`)) {
        log(`  irp_v2.${r.table_name}: ~${r.approx_rows} rows`);
      }
    }
    const { rows, failed } = await verify(db, log);
    console.table(rows.map((r) => ({ section: r.section, check: r.check_name, expected: String(r.expected), actual: String(r.actual), result: r.result })));
    console.log(`\nchecks: ${rows.length}, FAILED: ${failed}`);
    if (failed > 0) exitCode = 1;
  }
} catch (err) {
  console.error(`\n${command} FAILED: ${err?.message ?? err}`);
  // Postgres "Failing row contains (...)" holds real student data; keep it out of the terminal.
  if (err?.detail) console.error(`detail: ${String(err.detail).replace(/Failing row contains \(.*\)/s, "Failing row contains (<redacted>)")}`);
  exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
log(`${command} finished, exit code ${exitCode}`);
process.exit(exitCode);
