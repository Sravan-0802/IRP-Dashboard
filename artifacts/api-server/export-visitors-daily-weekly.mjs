/**
 * Daily + weekly IRP dashboard visitors from 1 Oct 2026 (IST).
 * One visit = one dashboard_visit event (browser session).
 *
 * Usage:
 *   node artifacts/api-server/export-visitors-daily-weekly.mjs
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

const SINCE = "2026-10-01 00:00:00+05:30";

const DAILY_UID_SQL = `
SELECT
  to_char((e.created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS date_ist,
  e.academy_user_id AS user_id,
  COALESCE(b.user_name, '') AS name,
  COUNT(*)::int AS visit_count
FROM dashboard_analytics_events e
LEFT JOIN academy_user_basic_details b ON b.user_id = e.academy_user_id
WHERE e.event_type = 'dashboard_visit'
  AND e.created_at >= $1::timestamptz
GROUP BY 1, 2, 3
ORDER BY 1, 2
`;

const WEEKLY_UID_SQL = `
SELECT
  to_char(date_trunc('week', e.created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS week_start_ist,
  to_char((date_trunc('week', e.created_at AT TIME ZONE 'Asia/Kolkata') + interval '6 days')::date, 'YYYY-MM-DD') AS week_end_ist,
  EXTRACT(ISOYEAR FROM e.created_at AT TIME ZONE 'Asia/Kolkata')::int AS iso_year,
  EXTRACT(WEEK FROM e.created_at AT TIME ZONE 'Asia/Kolkata')::int AS iso_week,
  e.academy_user_id AS user_id,
  COALESCE(b.user_name, '') AS name,
  COUNT(*)::int AS visit_count
FROM dashboard_analytics_events e
LEFT JOIN academy_user_basic_details b ON b.user_id = e.academy_user_id
WHERE e.event_type = 'dashboard_visit'
  AND e.created_at >= $1::timestamptz
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY 1, 5
`;

const DAILY_SUMMARY_SQL = `
SELECT
  to_char((created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS date_ist,
  COUNT(DISTINCT academy_user_id)::int AS unique_uids,
  COUNT(*)::int AS visit_count
FROM dashboard_analytics_events
WHERE event_type = 'dashboard_visit'
  AND created_at >= $1::timestamptz
GROUP BY 1
ORDER BY 1
`;

const WEEKLY_SUMMARY_SQL = `
SELECT
  to_char(date_trunc('week', created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS week_start_ist,
  to_char((date_trunc('week', created_at AT TIME ZONE 'Asia/Kolkata') + interval '6 days')::date, 'YYYY-MM-DD') AS week_end_ist,
  EXTRACT(ISOYEAR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS iso_year,
  EXTRACT(WEEK FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS iso_week,
  COUNT(DISTINCT academy_user_id)::int AS unique_uids,
  COUNT(*)::int AS visit_count
FROM dashboard_analytics_events
WHERE event_type = 'dashboard_visit'
  AND created_at >= $1::timestamptz
GROUP BY 1, 2, 3, 4
ORDER BY 1
`;

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

function xmlEscape(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellXml(val) {
  if (val === null || val === undefined || val === "") {
    return "<Cell></Cell>";
  }
  if (typeof val === "number" || (typeof val === "string" && /^-?\d+$/.test(val))) {
    return `<Cell><Data ss:Type="Number">${xmlEscape(val)}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(val)}</Data></Cell>`;
}

function sheetXml(name, columns, rows) {
  const header = `<Row>${columns.map((c) => cellXml(c)).join("")}</Row>`;
  const body = rows.map((r) => `<Row>${columns.map((c) => cellXml(r[c])).join("")}</Row>`).join("\n");
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${header}${body}</Table></Worksheet>`;
}

function toWorkbook(sheets) {
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets.join("\n")}
</Workbook>
`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new pg.Pool({ connectionString: url });
  const [dailyUid, weeklyUid, dailySum, weeklySum] = await Promise.all([
    pool.query(DAILY_UID_SQL, [SINCE]),
    pool.query(WEEKLY_UID_SQL, [SINCE]),
    pool.query(DAILY_SUMMARY_SQL, [SINCE]),
    pool.query(WEEKLY_SUMMARY_SQL, [SINCE]),
  ]);
  await pool.end();

  const dailyUidCols = ["date_ist", "user_id", "name", "visit_count"];
  const weeklyUidCols = [
    "iso_year",
    "iso_week",
    "week_start_ist",
    "week_end_ist",
    "user_id",
    "name",
    "visit_count",
  ];
  const dailySumCols = ["date_ist", "unique_uids", "visit_count"];
  const weeklySumCols = [
    "iso_year",
    "iso_week",
    "week_start_ist",
    "week_end_ist",
    "unique_uids",
    "visit_count",
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = resolve(root, "exports");
  mkdirSync(outDir, { recursive: true });
  const base = `IRP-Dashboard-Visitors-from-Oct-2026-${stamp}`;

  writeFileSync(resolve(outDir, `${base}-Daily-UID.csv`), toCsv(dailyUid.rows, dailyUidCols), "utf8");
  writeFileSync(resolve(outDir, `${base}-Weekly-UID.csv`), toCsv(weeklyUid.rows, weeklyUidCols), "utf8");
  writeFileSync(resolve(outDir, `${base}-Daily-Summary.csv`), toCsv(dailySum.rows, dailySumCols), "utf8");
  writeFileSync(
    resolve(outDir, `${base}-Weekly-Summary.csv`),
    toCsv(weeklySum.rows, weeklySumCols),
    "utf8",
  );

  const xlsPath = resolve(outDir, `${base}.xls`);
  writeFileSync(
    xlsPath,
    toWorkbook([
      sheetXml("Daily UID", dailyUidCols, dailyUid.rows),
      sheetXml("Weekly UID", weeklyUidCols, weeklyUid.rows),
      sheetXml("Daily Summary", dailySumCols, dailySum.rows),
      sheetXml("Weekly Summary", weeklySumCols, weeklySum.rows),
    ]),
    "utf8",
  );

  const totalVisits = dailySum.rows.reduce((n, r) => n + Number(r.visit_count), 0);
  const uniqueEver = new Set(dailyUid.rows.map((r) => r.user_id)).size;

  console.log(`Workbook: ${xlsPath}`);
  console.log(`Daily UID rows: ${dailyUid.rows.length}`);
  console.log(`Weekly UID rows: ${weeklyUid.rows.length}`);
  console.log(`Days: ${dailySum.rows.length}`);
  console.log(`Weeks: ${weeklySum.rows.length}`);
  console.log(`Unique UIDs: ${uniqueEver}`);
  console.log(`Total visits: ${totalVisits}`);
  console.log("Weekly summary:");
  for (const w of weeklySum.rows) {
    console.log(
      `  ${w.week_start_ist} to ${w.week_end_ist} (W${w.iso_week}): ${w.unique_uids} uids, ${w.visit_count} visits`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
