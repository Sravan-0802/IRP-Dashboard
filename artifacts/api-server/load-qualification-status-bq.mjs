import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BigQuery } from "@google-cloud/bigquery";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(root, ".env");
const csvPath = resolve(root, "exports/TopInTech-Assessments-All-Rows.csv");

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
  process.env[key] ??= value;
}

const projectId = process.env.project_id;
const datasetId = "academy_student_success_pocs_data_output";
const tableId = "academy_irp_2_0_assessment_qualification_status_output";
const fq = `${projectId}.${datasetId}.${tableId}`;
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

const table = bq.dataset(datasetId, { projectId }).table(tableId);

console.log(JSON.stringify({ loading: csvPath, table: fq }));

const [job] = await table.load(csvPath, {
  sourceFormat: "CSV",
  skipLeadingRows: 1,
  writeDisposition: "WRITE_TRUNCATE",
  allowQuotedNewlines: true,
  schema: {
    fields: [
      { name: "user_id", type: "STRING" },
      { name: "assessment_specific_tag", type: "STRING" },
      { name: "assessment_title", type: "STRING" },
      { name: "qualification_status", type: "STRING" },
    ],
  },
});

if (job.status?.errors?.length) {
  console.error(JSON.stringify({ errors: job.status.errors }, null, 2));
  process.exit(1);
}

const [countRows] = await bq.query({
  query: `SELECT COUNT(*) AS n FROM \`${fq}\``,
});
const [statusRows] = await bq.query({
  query: `SELECT qualification_status, COUNT(*) AS n FROM \`${fq}\` GROUP BY qualification_status ORDER BY n DESC`,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      table: fq,
      rowCount: Number(countRows[0]?.n ?? 0),
      byStatus: statusRows.map((r) => ({
        qualification_status: r.qualification_status,
        n: Number(r.n),
      })),
    },
    null,
    2,
  ),
);
