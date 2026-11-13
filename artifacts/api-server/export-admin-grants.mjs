/**
 * Export users with admin walk-in dashboard grant (manual-access-grant).
 *
 * Usage: DATABASE_URL in .env or env, then:
 *   node artifacts/api-server/export-admin-grants.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("../../lib/db/node_modules/pg");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(root, ".env");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
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

const EXPORT_SQL = `
WITH manual_grants AS (
  SELECT
    user_id AS academy_user_id,
    MIN(synced_at) AS admin_grant_at
  FROM academy_user_assessment_details
  WHERE organisation_assessment_id = 'manual-access-grant'
  GROUP BY user_id
),
real_assessment AS (
  SELECT DISTINCT user_id AS academy_user_id
  FROM academy_user_assessment_details
  WHERE organisation_assessment_id <> 'manual-access-grant'
),
first_visit AS (
  SELECT
    academy_user_id,
    MIN(created_at) AS first_dashboard_visit_at
  FROM dashboard_analytics_events
  WHERE event_type = 'dashboard_visit'
  GROUP BY academy_user_id
)
SELECT
  mg.academy_user_id,
  COALESCE(b.user_name, s.name, '') AS student_name,
  to_char(mg.admin_grant_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') AS admin_grant_at_ist,
  CASE WHEN s.id IS NOT NULL THEN 'Yes' ELSE 'No' END AS has_opened_dashboard,
  COALESCE(
    to_char(s.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS'),
    ''
  ) AS first_login_at_ist,
  COALESCE(
    to_char(fv.first_dashboard_visit_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS'),
    ''
  ) AS first_dashboard_visit_at_ist,
  CASE WHEN uu.academy_user_id IS NOT NULL THEN 'Unpaid' ELSE 'Paid' END AS payment_status,
  COALESCE(to_char(uu.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS'), '') AS unpaid_since_ist,
  CASE WHEN bl.academy_user_id IS NOT NULL THEN 'Yes' ELSE 'No' END AS blocked,
  CASE WHEN ra.academy_user_id IS NOT NULL THEN 'Yes' ELSE 'No' END AS also_has_synced_assessment_data,
  COALESCE(s.journey_state, '') AS journey_state,
  COALESCE(s.yog::text, '') AS yog,
  COALESCE(s.level, '') AS irp_level,
  COALESCE(to_char(b.synced_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS'), '') AS basic_profile_synced_at_ist
FROM manual_grants mg
LEFT JOIN academy_user_basic_details b ON b.user_id = mg.academy_user_id
LEFT JOIN students s ON s.email = mg.academy_user_id || '@academy.local'
LEFT JOIN unpaid_users uu ON uu.academy_user_id = mg.academy_user_id
LEFT JOIN blocked_users bl ON bl.academy_user_id = mg.academy_user_id
LEFT JOIN real_assessment ra ON ra.academy_user_id = mg.academy_user_id
LEFT JOIN first_visit fv ON fv.academy_user_id = mg.academy_user_id
ORDER BY mg.admin_grant_at, student_name, mg.academy_user_id;
`;

const COLUMNS = [
  "academy_user_id",
  "student_name",
  "admin_grant_at_ist",
  "has_opened_dashboard",
  "first_login_at_ist",
  "first_dashboard_visit_at_ist",
  "payment_status",
  "unpaid_since_ist",
  "blocked",
  "also_has_synced_assessment_data",
  "journey_state",
  "yog",
  "irp_level",
  "basic_profile_synced_at_ist",
];

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  return [COLUMNS.join(","), ...rows.map((row) => COLUMNS.map((c) => csvEscape(row[c])).join(","))].join(
    "\n",
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new pg.Pool({ connectionString: url });
  const { rows } = await pool.query(EXPORT_SQL);

  const loggedIn = rows.filter((r) => r.has_opened_dashboard === "Yes").length;
  const withVisit = rows.filter((r) => r.first_dashboard_visit_at_ist).length;
  const unpaid = rows.filter((r) => r.payment_status === "Unpaid").length;
  const alsoSync = rows.filter((r) => r.also_has_synced_assessment_data === "Yes").length;

  await pool.end();

  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = resolve(root, "exports");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `IRP-Admin-Grant-Users-${stamp}.csv`);
  writeFileSync(outPath, toCsv(rows), "utf8");

  console.log(`Written: ${outPath}`);
  console.log(`Rows: ${rows.length}`);
  console.log("Summary:", {
    total_admin_grants: rows.length,
    logged_in_once: loggedIn,
    never_logged_in: rows.length - loggedIn,
    has_dashboard_visit_event: withVisit,
    unpaid,
    also_has_synced_assessment: alsoSync,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
