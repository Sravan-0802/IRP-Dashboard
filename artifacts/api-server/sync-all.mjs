import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BigQuery } from "@google-cloud/bigquery";

const require = createRequire(import.meta.url);
const pg = require("../../lib/db/node_modules/pg");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(root, ".env");

for (const line of readFileSync(envPath, "utf8").split("\n")) {
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

const projectId = process.env.project_id;
const dataset = process.env.BQ_DATASET;
const privateKey = (process.env.private_key ?? "").replace(/\\n/g, "\n");

const bq = new BigQuery({
  projectId,
  credentials: {
    type: "service_account",
    project_id: projectId,
    private_key_id: process.env.private_key_id,
    private_key: privateKey,
    client_email: process.env.client_email,
    client_id: process.env.client_id,
    token_uri: process.env.token_uri ?? "https://oauth2.googleapis.com/token",
  },
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function syncBasicDetails() {
  const [rows] = await bq.query({
    query: `SELECT user_id, user_name FROM \`${projectId}.${dataset}.academy_users_basic_details_for_irp_portal\``,
  });
  let upserted = 0;
  for (const row of rows) {
    if (!row.user_id) continue;
    await pool.query(
      `INSERT INTO academy_user_basic_details (user_id, user_name, synced_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET user_name = EXCLUDED.user_name, synced_at = NOW()`,
      [String(row.user_id), row.user_name ?? null]
    );
    upserted++;
  }
  return upserted;
}

async function syncCourseProgress() {
  const [rows] = await bq.query({
    query: `SELECT
      user_id, course_id, course_title,
      mcqs_completed, total_mcqs, mcq_completion_pct,
      coding_problems_completed, total_coding_problems, coding_completion_pct,
      overall_completed, overall_total, overall_completion_pct
    FROM \`${projectId}.${dataset}.academy_users_course_progress_data_for_irp_portal\``,
  });
  let upserted = 0;
  for (const row of rows) {
    if (!row.user_id || !row.course_id) continue;
    await pool.query(
      `INSERT INTO academy_user_course_progress (
        user_id, course_id, course_title,
        mcqs_completed, total_mcqs, mcq_completion_pct,
        coding_problems_completed, total_coding_problems, coding_completion_pct,
        overall_completed, overall_total, overall_completion_pct, synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
      ON CONFLICT (user_id, course_id) DO UPDATE SET
        course_title = EXCLUDED.course_title,
        mcqs_completed = EXCLUDED.mcqs_completed,
        total_mcqs = EXCLUDED.total_mcqs,
        mcq_completion_pct = EXCLUDED.mcq_completion_pct,
        coding_problems_completed = EXCLUDED.coding_problems_completed,
        total_coding_problems = EXCLUDED.total_coding_problems,
        coding_completion_pct = EXCLUDED.coding_completion_pct,
        overall_completed = EXCLUDED.overall_completed,
        overall_total = EXCLUDED.overall_total,
        overall_completion_pct = EXCLUDED.overall_completion_pct,
        synced_at = NOW()`,
      [
        String(row.user_id),
        String(row.course_id),
        row.course_title ?? null,
        row.mcqs_completed ?? null,
        row.total_mcqs ?? null,
        row.mcq_completion_pct ?? null,
        row.coding_problems_completed ?? null,
        row.total_coding_problems ?? null,
        row.coding_completion_pct ?? null,
        row.overall_completed ?? null,
        row.overall_total ?? null,
        row.overall_completion_pct ?? null,
      ]
    );
    upserted++;
  }
  return upserted;
}

const basic = await syncBasicDetails();
const progress = await syncCourseProgress();

const sravan = await pool.query(
  `SELECT c.course_title, c.mcq_completion_pct, c.coding_completion_pct, c.overall_completion_pct
   FROM academy_user_course_progress c
   JOIN academy_user_basic_details u ON u.user_id = c.user_id
   WHERE u.user_name = 'Sravan'
   ORDER BY c.course_title
   LIMIT 10`
);

await pool.end();

console.log(JSON.stringify({ basicDetails: basic, courseProgress: progress, sravanSample: sravan.rows }, null, 2));
