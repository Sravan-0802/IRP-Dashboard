import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BigQuery } from "@google-cloud/bigquery";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] ??= value;
}

const projectId = process.env.project_id;
const pocs = `${projectId}.academy_student_success_pocs`;
const hustlerFq = `${pocs}.z_academy_irp_2_0_l1_hustler_assessment_user_attempt_details`;
const feFq = `${pocs}.z_academy_irp_2_0_l1_fe_project_user_attempt_details`;
const outFq = `${projectId}.academy_student_success_pocs_data_output.academy_irp_2_0_assessment_qualification_status_output`;
const privateKey = (process.env.private_key ?? "").replace(/\\n/g, "\n");
const bq = new BigQuery({
  projectId,
  credentials: {
    type: "service_account",
    project_id: projectId,
    private_key_id: process.env.private_key_id,
    private_key: privateKey,
    client_email: process.env.client_email,
    token_uri: process.env.token_uri ?? "https://oauth2.googleapis.com/token",
  },
});

async function byA(table, extraWhere = "") {
  const [rows] = await bq.query({
    query: `SELECT
        REGEXP_EXTRACT(UPPER(COALESCE(assessment_number, assessment_specific_tag, '')), r'A(\\d+)') AS a_num,
        COUNT(*) AS n,
        COUNT(DISTINCT user_id) AS users
      FROM \`${table}\`
      WHERE assessment_type = "MAIN"
        AND user_id IS NOT NULL
        ${extraWhere}
      GROUP BY 1
      ORDER BY SAFE_CAST(a_num AS INT64)`,
  });
  return rows.map((r) => ({ A: r.a_num, n: Number(r.n), users: Number(r.users) }));
}

const [hustlerTotal] = await bq.query({
  query: `SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM \`${hustlerFq}\` WHERE assessment_type = "MAIN"`,
});
const [feTotal] = await bq.query({
  query: `SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM \`${feFq}\` WHERE assessment_type = "MAIN"`,
});
const [outTotal] = await bq.query({
  query: `SELECT
      COUNT(*) AS n,
      COUNTIF(REGEXP_CONTAINS(UPPER(assessment_specific_tag), r'HUSTLER')) AS hustler,
      COUNTIF(REGEXP_CONTAINS(UPPER(assessment_specific_tag), r'FE[-_]PROJECT')) AS fe
    FROM \`${outFq}\``,
});

const hustlerByA = await byA(hustlerFq);
const feByA = await byA(feFq);

console.log(JSON.stringify({
  pocs_hustler_main: { records: Number(hustlerTotal[0].n), users: Number(hustlerTotal[0].users), byA: hustlerByA },
  pocs_fe_main: { records: Number(feTotal[0].n), users: Number(feTotal[0].users), byA: feByA },
  output_table: {
    records: Number(outTotal[0].n),
    hustler: Number(outTotal[0].hustler),
    fe: Number(outTotal[0].fe),
  },
}, null, 2));
