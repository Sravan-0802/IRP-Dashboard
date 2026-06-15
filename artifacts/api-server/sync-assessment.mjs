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
const ASSESSMENT_PHYSICAL_TABLE = "academy_users_irp_main_assessment_details_for_irp_portal";
const ASSESSMENT_VIEW_TABLE = "y_academy_users_irp_main_assessment_details_for_irp_portal";
const BATCH_SIZE = 500;

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

async function recordStatus(status, rowCount, error) {
  const durationMs = Date.now() - start;
  await pool.query(
    `INSERT INTO bigquery_sync_status (table_name, status, row_count, duration_ms, error, last_synced_at, updated_at)
     VALUES ('academy_user_assessment_details', $1, $2, $3, $4, $5, NOW())
     ON CONFLICT (table_name) DO UPDATE SET
       status = EXCLUDED.status,
       row_count = EXCLUDED.row_count,
       duration_ms = EXCLUDED.duration_ms,
       error = EXCLUDED.error,
       last_synced_at = EXCLUDED.last_synced_at,
       updated_at = NOW()`,
    [
      status,
      rowCount,
      durationMs,
      error,
      status === "success" ? new Date() : null,
    ],
  );
}

const start = Date.now();
console.log("Fetching assessment details from BigQuery...");

async function resolveAssessmentTable() {
  const configured = process.env.BQ_ASSESSMENT_TABLE?.trim();
  const candidates = [
    configured,
    ASSESSMENT_PHYSICAL_TABLE,
    ASSESSMENT_VIEW_TABLE,
  ].filter(Boolean);
  let lastError = null;
  for (const table of candidates) {
    try {
      await bq.query({
        query: `SELECT 1 FROM \`${projectId}.${dataset}.${table}\` LIMIT 1`,
      });
      console.log(`Using assessment table: ${table}`);
      return table;
    } catch (err) {
      lastError = err;
      console.warn(`Table ${table} not queryable: ${err.message.split("\n")[0]}`);
    }
  }
  throw lastError ?? new Error("No queryable assessment table found");
}

try {
const table = await resolveAssessmentTable();
const [rows] = await bq.query({
  query: `SELECT
    user_id, organisation_assessment_id, assessment_title,
    assessment_tag_str_extracted, level, cycle,
    mcq_section_max_score, mcq_user_section_score, mcq_user_attempt_duration_in_mins,
    coding_section_max_score, coding_user_section_score, coding_user_attempt_duration_in_mins,
    assessment_total_score, assessment_user_score
  FROM \`${projectId}.${dataset}.${table}\``,
});

console.log(`Fetched ${rows.length} rows in ${Date.now() - start}ms`);

const mapped = [];
const seen = new Set();
for (const row of rows) {
  if (!row.user_id || !row.organisation_assessment_id) continue;
  const key = `${row.user_id}:${row.organisation_assessment_id}`;
  if (seen.has(key)) continue;
  seen.add(key);
  mapped.push(row);
}

let upserted = 0;
for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
  const batch = mapped.slice(i, i + BATCH_SIZE);
  const values = [];
  const params = [];
  let p = 1;

  for (const row of batch) {
    values.push(
      `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},NOW())`,
    );
    params.push(
      String(row.user_id),
      String(row.organisation_assessment_id),
      row.assessment_title ?? null,
      row.assessment_tag_str_extracted ?? null,
      row.level ?? null,
      row.cycle ?? null,
      row.mcq_section_max_score ?? null,
      row.mcq_user_section_score ?? null,
      row.mcq_user_attempt_duration_in_mins ?? null,
      row.coding_section_max_score ?? null,
      row.coding_user_section_score ?? null,
      row.coding_user_attempt_duration_in_mins ?? null,
      row.assessment_total_score ?? null,
      row.assessment_user_score ?? null,
    );
  }

  await pool.query(
    `INSERT INTO academy_user_assessment_details (
      user_id, organisation_assessment_id, assessment_title, assessment_tag,
      level, cycle,
      mcq_section_max_score, mcq_user_section_score, mcq_attempt_duration_mins,
      coding_section_max_score, coding_user_section_score, coding_attempt_duration_mins,
      assessment_total_score, assessment_user_score, synced_at
    ) VALUES ${values.join(",")}
    ON CONFLICT (user_id, organisation_assessment_id) DO UPDATE SET
      assessment_title = EXCLUDED.assessment_title,
      assessment_tag = EXCLUDED.assessment_tag,
      level = EXCLUDED.level,
      cycle = EXCLUDED.cycle,
      mcq_section_max_score = EXCLUDED.mcq_section_max_score,
      mcq_user_section_score = EXCLUDED.mcq_user_section_score,
      mcq_attempt_duration_mins = EXCLUDED.mcq_attempt_duration_mins,
      coding_section_max_score = EXCLUDED.coding_section_max_score,
      coding_user_section_score = EXCLUDED.coding_user_section_score,
      coding_attempt_duration_mins = EXCLUDED.coding_attempt_duration_mins,
      assessment_total_score = EXCLUDED.assessment_total_score,
      assessment_user_score = EXCLUDED.assessment_user_score,
      synced_at = NOW()`,
    params,
  );
  upserted += batch.length;
  console.log(`Upserted ${upserted}/${mapped.length}`);
}

const count = await pool.query("SELECT COUNT(*)::int AS c, COUNT(DISTINCT user_id)::int AS users FROM academy_user_assessment_details");
const sample = await pool.query(
  `SELECT user_id, assessment_title, assessment_user_score, assessment_total_score, level
   FROM academy_user_assessment_details
   ORDER BY synced_at DESC
   LIMIT 5`,
);

await recordStatus("success", upserted, null);
await pool.end();

console.log(
  JSON.stringify(
    {
      status: "success",
      fetched: rows.length,
      upserted,
      totalInPostgres: count.rows[0].c,
      distinctUsers: count.rows[0].users,
      durationMs: Date.now() - start,
      sample: sample.rows,
    },
    null,
    2,
  ),
);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  await recordStatus("error", 0, message).catch(() => {});
  await pool.end().catch(() => {});
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}
