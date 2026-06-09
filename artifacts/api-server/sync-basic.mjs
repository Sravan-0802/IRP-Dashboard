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

const [rows] = await bq.query({
  query: `SELECT user_id, user_name FROM \`${projectId}.${dataset}.academy_users_basic_details_for_irp_portal\``,
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
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

const sample = await pool.query(
  "SELECT user_id, user_name FROM academy_user_basic_details ORDER BY user_name LIMIT 5"
);
await pool.end();

console.log(JSON.stringify({ upserted, sample: sample.rows }, null, 2));
