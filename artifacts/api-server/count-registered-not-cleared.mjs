import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("../../lib/db/node_modules/pg");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const FE =
  "(UPPER(COALESCE(level,'')) LIKE '%FE-PROJECT%' OR UPPER(COALESCE(level,'')) LIKE '%FE_PROJECT%' OR UPPER(COALESCE(assessment_tag,'')) LIKE '%FE-PROJECT%' OR UPPER(COALESCE(assessment_title,'')) LIKE '%FE PROJECT%')";

const ATTEMPTED =
  "(assessment_user_score IS NOT NULL OR mcq_user_section_score IS NOT NULL OR coding_user_section_score IS NOT NULL)";

const CLEARED =
  "(assessment_total_score > 0 AND assessment_user_score >= assessment_total_score * 0.7)";

// Per-user online L1 status (C1/C2, excluding FE Project rows)
const perUserOnline = `
per_user_online AS (
  SELECT
    user_id,
    MAX(CASE WHEN TRIM(cycle) IN ('C1','C2') AND NOT ${FE} AND ${ATTEMPTED} THEN 1 ELSE 0 END) AS attempted,
    MAX(CASE WHEN TRIM(cycle) IN ('C1','C2') AND NOT ${FE} AND ${CLEARED}  THEN 1 ELSE 0 END) AS cleared
  FROM academy_user_assessment_details
  GROUP BY user_id
)`;

const sql = `
WITH ${perUserOnline},
regs AS (
  SELECT DISTINCT academy_user_id AS user_id FROM l1_cycle_registrations
),
regs_joined AS (
  SELECT
    r.user_id,
    COALESCE(o.attempted, 0) AS attempted,
    COALESCE(o.cleared, 0)   AS cleared
  FROM regs r
  LEFT JOIN per_user_online o ON o.user_id = r.user_id
)
SELECT
  (SELECT COUNT(*) FROM regs)::int AS registered_total,
  COUNT(*) FILTER (WHERE cleared = 1)::int                         AS registered_cleared,
  COUNT(*) FILTER (WHERE cleared = 0)::int                         AS registered_not_cleared,
  COUNT(*) FILTER (WHERE cleared = 0 AND attempted = 1)::int       AS registered_attempted_not_cleared,
  COUNT(*) FILTER (WHERE cleared = 0 AND attempted = 0)::int       AS registered_not_attempted
FROM regs_joined;
`;

const regByCycle = `
SELECT cycle, COUNT(DISTINCT academy_user_id)::int AS registered_users
FROM l1_cycle_registrations
GROUP BY cycle
ORDER BY cycle;
`;

const syncStatus = `
SELECT table_name, status, row_count, last_synced_at
FROM bigquery_sync_status
ORDER BY table_name;
`;

const [main, byCycle, sync] = await Promise.all([
  pool.query(sql),
  pool.query(regByCycle),
  pool.query(syncStatus).catch((e) => ({ rows: [{ error: e.message }] })),
]);

await pool.end();

console.log(
  JSON.stringify(
    {
      note: "online L1 = C1/C2 rows excluding FE Project; cleared = user_score >= 70% of total. 'registered' = distinct academy_user_id in l1_cycle_registrations.",
      registered_summary: main.rows[0],
      registered_by_cycle: byCycle.rows,
      data_freshness_bigquery_sync_status: sync.rows,
    },
    null,
    2,
  ),
);
