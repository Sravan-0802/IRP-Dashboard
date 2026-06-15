import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BigQuery } from "@google-cloud/bigquery";

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

const BASIC = "academy_users_basic_details_for_irp_portal";
const PROGRESS = "academy_users_course_progress_data_for_irp_portal";
const ASSESSMENT = "y_academy_users_irp_main_assessment_details_for_irp_portal";

const [datasets] = await bq.getDatasets();
let foundDataset = process.env.BQ_DATASET?.trim() || null;

if (!foundDataset) {
  for (const ds of datasets) {
    if (!ds.id) continue;
    const [tables] = await ds.getTables();
    const ids = tables.map((t) => t.id);
    if (ids.includes(BASIC) || ids.includes(PROGRESS) || ids.includes(ASSESSMENT)) {
      foundDataset = ds.id;
      break;
    }
  }
}

console.log(JSON.stringify({ projectId, dataset: foundDataset, datasetCount: datasets.length }, null, 2));

if (!foundDataset) {
  console.error("Could not find IRP tables. Available datasets:", datasets.map((d) => d.id).slice(0, 20));
  process.exit(1);
}

const sampleBasic = await bq.query({
  query: `SELECT user_id, user_name FROM \`${projectId}.${foundDataset}.${BASIC}\` LIMIT 5`,
});
const sampleProgress = await bq.query({
  query: `SELECT user_id, course_title, overall_completion_pct FROM \`${projectId}.${foundDataset}.${PROGRESS}\` LIMIT 5`,
});
const sampleAssessment = await bq.query({
  query: `SELECT user_id, assessment_title, assessment_user_score, assessment_total_score FROM \`${projectId}.${foundDataset}.${ASSESSMENT}\` LIMIT 5`,
});

console.log("\nBasic details sample:");
console.table(sampleBasic[0]);
console.log("\nCourse progress sample:");
console.table(sampleProgress[0]);
console.log("\nAssessment details sample:");
console.table(sampleAssessment[0]);
