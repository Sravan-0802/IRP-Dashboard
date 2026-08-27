/**
 * Check whether the IRP 2.0 L1 z_* attempt tables exist in BigQuery.
 * Loads credentials from repo-root .env (project_id, client_email, private_key, BQ_DATASET).
 *
 * Usage: node check-z-academy-tables.mjs
 */
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

const needed = ["project_id", "client_email", "private_key"];
const missing = needed.filter((k) => !String(process.env[k] ?? "").trim());
if (missing.length) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: "Missing BigQuery env vars in .env",
        missing,
        hint: "Add project_id, client_email, private_key from Replit Secrets (and BQ_DATASET).",
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

const projectId = process.env.project_id;
const dataset = process.env.BQ_DATASET?.trim() || "academy_student_success_pocs";
const tables = [
  "z_academy_irp_2_0_l1_fe_project_user_attempt_details",
  "z_academy_irp_2_0_l1_hustler_assessment_user_attempt_details",
  "z_academy_irp_2_0_l1_nxtmock_user_attempt_details",
  "z_academy_irp_2_0_l1_user_round_wise_summary",
];

const bq = new BigQuery({
  projectId,
  credentials: {
    type: "service_account",
    project_id: projectId,
    private_key_id: process.env.private_key_id,
    private_key: (process.env.private_key ?? "").replace(/\\n/g, "\n"),
    client_email: process.env.client_email,
    client_id: process.env.client_id,
    token_uri: process.env.token_uri ?? "https://oauth2.googleapis.com/token",
  },
});

console.log(
  JSON.stringify(
    {
      projectId,
      dataset,
      client_email: process.env.client_email,
    },
    null,
    2,
  ),
);

const results = [];
for (const table of tables) {
  const fq = `${projectId}.${dataset}.${table}`;
  try {
    const [rows] = await bq.query({
      query: `SELECT COUNT(1) AS c FROM \`${fq}\``,
    });
    results.push({
      table,
      available: true,
      rowCount: Number(rows[0]?.c ?? 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({
      table,
      available: false,
      notFound: /Not found: Table|was not found/i.test(msg),
      error: msg.slice(0, 300),
    });
  }
}

console.log(JSON.stringify({ results }, null, 2));
process.exit(results.every((r) => r.available) ? 0 : 1);
