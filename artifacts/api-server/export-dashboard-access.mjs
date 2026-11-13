/**
 * Export IRP dashboard access + payment status (single CSV).
 *
 * Usage: DATABASE_URL in .env or env, then:
 *   node artifacts/api-server/export-dashboard-access.mjs
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
WITH all_users AS (
  SELECT user_id AS academy_user_id FROM academy_user_basic_details
  UNION
  SELECT user_id AS academy_user_id FROM academy_user_assessment_details
  UNION
  SELECT academy_user_id FROM unpaid_users
  UNION
  SELECT academy_user_id FROM blocked_users
),
real_assessment AS (
  SELECT DISTINCT user_id AS academy_user_id
  FROM academy_user_assessment_details
  WHERE organisation_assessment_id <> 'manual-access-grant'
),
manual_grant AS (
  SELECT DISTINCT user_id AS academy_user_id
  FROM academy_user_assessment_details
  WHERE organisation_assessment_id = 'manual-access-grant'
)
SELECT
  u.academy_user_id,
  COALESCE(b.user_name, '') AS student_name,
  CASE WHEN uu.academy_user_id IS NOT NULL THEN 'No' ELSE 'Yes' END AS paid,
  CASE WHEN uu.academy_user_id IS NOT NULL THEN 'Unpaid' ELSE 'Paid' END AS payment_status,
  COALESCE(uu.created_at::text, '') AS unpaid_since,
  CASE WHEN bl.academy_user_id IS NOT NULL THEN 'Yes' ELSE 'No' END AS blocked,
  CASE WHEN mg.academy_user_id IS NOT NULL THEN 'Yes' ELSE 'No' END AS admin_walk_in_grant,
  CASE WHEN ra.academy_user_id IS NOT NULL THEN 'Yes' ELSE 'No' END AS enrolled_in_irp_assessment_data,
  CASE
    WHEN bl.academy_user_id IS NOT NULL THEN 'Blocked — cannot log in'
    WHEN uu.academy_user_id IS NOT NULL THEN 'Payment required — dashboard locked'
    WHEN mg.academy_user_id IS NOT NULL OR ra.academy_user_id IS NOT NULL THEN 'Yes — can open dashboard'
    ELSE 'No — not enrolled in IRP data'
  END AS dashboard_access,
  CASE
    WHEN bl.academy_user_id IS NOT NULL THEN 'Blocked'
    WHEN ra.academy_user_id IS NOT NULL AND uu.academy_user_id IS NULL THEN 'Enrolled (synced assessment data)'
    WHEN ra.academy_user_id IS NOT NULL AND uu.academy_user_id IS NOT NULL THEN 'Enrolled but unpaid'
    WHEN mg.academy_user_id IS NOT NULL THEN 'Walk-in grant (admin)'
    WHEN uu.academy_user_id IS NOT NULL THEN 'Unpaid only (no assessment data)'
    ELSE 'Basic profile only'
  END AS access_source
FROM all_users u
LEFT JOIN academy_user_basic_details b ON b.user_id = u.academy_user_id
LEFT JOIN unpaid_users uu ON uu.academy_user_id = u.academy_user_id
LEFT JOIN blocked_users bl ON bl.academy_user_id = u.academy_user_id
LEFT JOIN manual_grant mg ON mg.academy_user_id = u.academy_user_id
LEFT JOIN real_assessment ra ON ra.academy_user_id = u.academy_user_id
ORDER BY
  dashboard_access,
  payment_status,
  student_name,
  u.academy_user_id;
`;

const COLUMNS = [
  "academy_user_id",
  "student_name",
  "paid",
  "payment_status",
  "unpaid_since",
  "dashboard_access",
  "access_source",
  "enrolled_in_irp_assessment_data",
  "admin_walk_in_grant",
  "blocked",
];

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  const header = COLUMNS.join(",");
  const lines = rows.map((row) => COLUMNS.map((c) => csvEscape(row[c])).join(","));
  return [header, ...lines].join("\n");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new pg.Pool({ connectionString: url });
  const { rows } = await pool.query(EXPORT_SQL);

  const summary = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM unpaid_users) AS unpaid,
      (SELECT COUNT(*)::int FROM blocked_users) AS blocked,
      (SELECT COUNT(DISTINCT user_id)::int FROM academy_user_assessment_details
        WHERE organisation_assessment_id <> 'manual-access-grant') AS enrolled,
      (SELECT COUNT(DISTINCT user_id)::int FROM academy_user_assessment_details
        WHERE organisation_assessment_id = 'manual-access-grant') AS walk_in_grants
  `);

  await pool.end();

  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = resolve(root, "exports");
  mkdirSync(outDir, { recursive: true });

  const outPath = resolve(outDir, `IRP-Dashboard-Access-and-Payment-${stamp}.csv`);
  writeFileSync(outPath, toCsv(rows), "utf8");

  console.log(`Written: ${outPath}`);
  console.log(`Rows: ${rows.length}`);
  console.log("Summary:", { total: rows.length, ...summary.rows[0] });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
