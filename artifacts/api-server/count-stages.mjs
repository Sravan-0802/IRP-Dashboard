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

const stageSql = `
WITH assessment_rows AS (
  SELECT
    user_id,
    TRIM(cycle) AS cycle,
    UPPER(COALESCE(level, '')) AS level_u,
    UPPER(COALESCE(assessment_tag, '')) AS tag_u,
    UPPER(COALESCE(assessment_title, '')) AS title_u,
    assessment_user_score,
    assessment_total_score,
    mcq_user_section_score,
    coding_user_section_score
  FROM academy_user_assessment_details
),
per_user AS (
  SELECT
    user_id,
    MAX(CASE WHEN cycle = 'C1' AND NOT (level_u LIKE '%FE-PROJECT%' OR level_u LIKE '%FE_PROJECT%' OR tag_u LIKE '%FE-PROJECT%' OR title_u LIKE '%FE PROJECT%')
      THEN CASE WHEN assessment_user_score IS NOT NULL OR mcq_user_section_score IS NOT NULL OR coding_user_section_score IS NOT NULL THEN 1 ELSE 0 END
    END) AS c1_attempted,
    MAX(CASE WHEN cycle = 'C1' AND NOT (level_u LIKE '%FE-PROJECT%' OR level_u LIKE '%FE_PROJECT%' OR tag_u LIKE '%FE-PROJECT%' OR title_u LIKE '%FE PROJECT%')
      AND assessment_total_score > 0 AND assessment_user_score >= assessment_total_score * 0.7 THEN 1 ELSE 0 END) AS c1_cleared,
    MAX(CASE WHEN cycle = 'C2' AND NOT (level_u LIKE '%FE-PROJECT%' OR level_u LIKE '%FE_PROJECT%' OR tag_u LIKE '%FE-PROJECT%' OR title_u LIKE '%FE PROJECT%')
      THEN CASE WHEN assessment_user_score IS NOT NULL OR mcq_user_section_score IS NOT NULL OR coding_user_section_score IS NOT NULL THEN 1 ELSE 0 END
    END) AS c2_attempted,
    MAX(CASE WHEN cycle = 'C2' AND NOT (level_u LIKE '%FE-PROJECT%' OR level_u LIKE '%FE_PROJECT%' OR tag_u LIKE '%FE-PROJECT%' OR title_u LIKE '%FE PROJECT%')
      AND assessment_total_score > 0 AND assessment_user_score >= assessment_total_score * 0.7 THEN 1 ELSE 0 END) AS c2_cleared,
    MAX(CASE WHEN level_u LIKE '%FE-PROJECT%' OR level_u LIKE '%FE_PROJECT%' OR tag_u LIKE '%FE-PROJECT%' OR title_u LIKE '%FE PROJECT%' THEN 1 ELSE 0 END) AS has_fe_row,
    MAX(CASE WHEN (level_u LIKE '%FE-PROJECT%' OR level_u LIKE '%FE_PROJECT%' OR tag_u LIKE '%FE-PROJECT%' OR title_u LIKE '%FE PROJECT%')
      AND (COALESCE(assessment_user_score,0) > 0 OR COALESCE(mcq_user_section_score,0) > 0 OR COALESCE(coding_user_section_score,0) > 0) THEN 1 ELSE 0 END) AS fe_attempted,
    MAX(CASE WHEN (level_u LIKE '%FE-PROJECT%' OR level_u LIKE '%FE_PROJECT%' OR tag_u LIKE '%FE-PROJECT%' OR title_u LIKE '%FE PROJECT%')
      AND assessment_total_score > 0 AND assessment_user_score >= assessment_total_score THEN 1 ELSE 0 END) AS fe_cleared,
    MAX(CASE WHEN cycle = 'C2' THEN 1 ELSE 0 END) AS has_c2_row
  FROM assessment_rows
  GROUP BY user_id
),
staged AS (
  SELECT
    user_id,
    CASE
      WHEN c1_cleared = 1 THEN 'C1 Cleared → FE / Interview pipeline'
      WHEN c1_attempted = 1 THEN 'C1 Attempted (not cleared)'
      WHEN c2_cleared = 1 THEN 'C2 Cleared'
      WHEN c2_attempted = 1 THEN 'C2 Attempted (not cleared)'
      WHEN has_c2_row = 1 THEN 'C2 Registered (not attempted)'
      ELSE 'No online attempt yet'
    END AS online_stage,
    CASE
      WHEN fe_cleared = 1 THEN 'FE Project cleared (20/20)'
      WHEN fe_attempted = 1 THEN 'FE Project attempted (not cleared)'
      WHEN has_fe_row = 1 THEN 'FE Project assigned (in progress)'
      ELSE 'No FE Project row'
    END AS fe_stage
  FROM per_user
)
SELECT online_stage AS stage, COUNT(*)::int AS students FROM staged GROUP BY online_stage ORDER BY students DESC;
`;

const feSql = stageSql.replace(
  "SELECT online_stage AS stage",
  "SELECT fe_stage AS stage",
).replace(
  "GROUP BY online_stage",
  "GROUP BY fe_stage",
);

const cycleSql = `
SELECT
  TRIM(cycle) AS cycle,
  COUNT(DISTINCT user_id)::int AS students_with_row,
  COUNT(DISTINCT user_id) FILTER (
    WHERE assessment_user_score IS NOT NULL
       OR mcq_user_section_score IS NOT NULL
       OR coding_user_section_score IS NOT NULL
  )::int AS attempted,
  COUNT(DISTINCT user_id) FILTER (
    WHERE assessment_total_score > 0
      AND assessment_user_score >= assessment_total_score * 0.7
  )::int AS cleared_70pct
FROM academy_user_assessment_details
WHERE TRIM(cycle) IN ('C1', 'C2')
GROUP BY TRIM(cycle)
ORDER BY cycle;
`;

const journeySql = `
SELECT journey_state AS stage, COUNT(*)::int AS students
FROM students
GROUP BY journey_state
ORDER BY students DESC;
`;

const enrolledSql = `SELECT COUNT(DISTINCT user_id)::int AS total FROM academy_user_basic_details`;

const humanInterviewSql = `
SELECT journey_state AS stage, COUNT(*)::int AS students
FROM students
WHERE journey_state = 'L1_HUMAN_INTERVIEW'
GROUP BY journey_state;
`;

const projectSubmittedSql = `
SELECT
  CASE WHEN project_submitted = 1 THEN 'FE marked done (portal flag)' ELSE 'FE not marked done (portal)' END AS stage,
  COUNT(*)::int AS students
FROM students
GROUP BY project_submitted
ORDER BY project_submitted DESC;
`;

const [enrolled, cycle, online, fe, journey, human, projectFlag] = await Promise.all([
  pool.query(enrolledSql),
  pool.query(cycleSql),
  pool.query(stageSql),
  pool.query(feSql),
  pool.query(journeySql),
  pool.query(humanInterviewSql),
  pool.query(projectSubmittedSql),
]);

await pool.end();

console.log(
  JSON.stringify(
    {
      source: "Postgres mirror (synced from BigQuery)",
      total_enrolled: enrolled.rows[0].total,
      cycle_breakdown: cycle.rows,
      online_pipeline_stages: online.rows,
      fe_project_stages: fe.rows,
      portal_journey_states: journey.rows,
      human_interview_state: human.rows,
      portal_fe_project_flags: projectFlag.rows,
    },
    null,
    2,
  ),
);
