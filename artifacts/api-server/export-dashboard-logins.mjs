/**
 * Export IRP dashboard logins month-wise.
 *
 * login_count = number of dashboard_visit events (one per browser session).
 * first_login = earliest dashboard_visit (fallback: students.created_at).
 *
 * Usage:
 *   DATABASE_URL=... node artifacts/api-server/export-dashboard-logins.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("../../lib/db/node_modules/pg");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
try {
  for (const line of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[t.slice(0, eq).trim()]) {
      process.env[t.slice(0, eq).trim()] = v;
    }
  }
} catch {
  // use process.env.DATABASE_URL
}

const DETAIL_SQL = `
WITH visits AS (
  SELECT
    academy_user_id AS user_id,
    MIN(created_at) AS first_visit_at,
    COUNT(*)::int AS login_count
  FROM dashboard_analytics_events
  WHERE event_type = 'dashboard_visit'
  GROUP BY academy_user_id
),
student_first AS (
  SELECT
    REPLACE(email, '@academy.local', '') AS user_id,
    email,
    name,
    created_at AS student_created_at
  FROM students
  WHERE email LIKE '%@academy.local'
)
SELECT
  COALESCE(v.user_id, sf.user_id) AS user_id,
  COALESCE(v.first_visit_at, sf.student_created_at) AS first_login_at_utc_ts,
  to_char(
    COALESCE(v.first_visit_at, sf.student_created_at) AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS"Z"'
  ) AS first_login_at_utc,
  to_char(
    COALESCE(v.first_visit_at, sf.student_created_at) AT TIME ZONE 'Asia/Kolkata',
    'YYYY-MM-DD HH24:MI:SS'
  ) AS first_login_at_ist,
  to_char(
    COALESCE(v.first_visit_at, sf.student_created_at) AT TIME ZONE 'Asia/Kolkata',
    'YYYY-MM'
  ) AS month_ist,
  to_char(
    COALESCE(v.first_visit_at, sf.student_created_at) AT TIME ZONE 'UTC',
    'YYYY-MM'
  ) AS month_utc,
  COALESCE(b.user_name, sf.name, '') AS name,
  COALESCE(sf.email, COALESCE(v.user_id, sf.user_id) || '@academy.local') AS email,
  COALESCE(v.login_count, 0)::int AS login_count
FROM visits v
FULL OUTER JOIN student_first sf ON sf.user_id = v.user_id
LEFT JOIN academy_user_basic_details b
  ON b.user_id = COALESCE(v.user_id, sf.user_id)
WHERE COALESCE(v.first_visit_at, sf.student_created_at) IS NOT NULL
ORDER BY month_ist, first_login_at_utc_ts, user_id;
`;

const MONTHLY_SQL = `
SELECT
  month_ist,
  month_utc,
  COUNT(*)::int AS users,
  SUM(login_count)::int AS total_logins,
  COUNT(*) FILTER (WHERE login_count > 0)::int AS users_with_visit_events,
  COUNT(*) FILTER (WHERE login_count = 0)::int AS users_student_row_only
FROM (${DETAIL_SQL.replace(/;\s*$/, "")}) d
GROUP BY month_ist, month_utc
ORDER BY month_ist;
`;

const DETAIL_COLUMNS = [
  "user_id",
  "first_login_at_utc",
  "first_login_at_ist",
  "month_ist",
  "month_utc",
  "name",
  "email",
  "login_count",
];

const MONTHLY_COLUMNS = [
  "month_ist",
  "month_utc",
  "users",
  "total_logins",
  "users_with_visit_events",
  "users_student_row_only",
];

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  return [columns.join(","), ...rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","))].join(
    "\n",
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new pg.Pool({ connectionString: url });
  const { rows } = await pool.query(DETAIL_SQL);
  const monthly = await pool.query(MONTHLY_SQL);
  await pool.end();

  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = resolve(root, "exports");
  mkdirSync(outDir, { recursive: true });

  const detailPath = resolve(outDir, `IRP-Dashboard-Logins-${stamp}.csv`);
  const monthlyPath = resolve(outDir, `IRP-Dashboard-Logins-Monthly-${stamp}.csv`);

  writeFileSync(detailPath, toCsv(rows, DETAIL_COLUMNS), "utf8");
  writeFileSync(monthlyPath, toCsv(monthly.rows, MONTHLY_COLUMNS), "utf8");

  console.log(`Detail:  ${detailPath} (${rows.length} users)`);
  console.log(`Monthly: ${monthlyPath}`);
  console.log("Month-wise:");
  for (const m of monthly.rows) {
    console.log(
      `  ${m.month_ist} (IST) / ${m.month_utc} (UTC): ${m.users} users, ${m.total_logins} logins`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
