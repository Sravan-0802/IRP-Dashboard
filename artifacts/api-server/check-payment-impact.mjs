/**
 * Compares the current payment gate (`unpaid_users` table) against
 * `payment_status` from the POCs table, restricted to users who actually have
 * dashboard access (a row in academy_user_assessment_details).
 *
 * Usage: node check-payment-impact.mjs
 */
import fs from "fs";
import path from "path";
import { BigQuery } from "@google-cloud/bigquery";

// `pg` only lives in the db workspace package.
const pg = (await import(path.resolve(process.cwd(), "../../lib/db/node_modules/pg/esm/index.mjs")))
  .default;

const envPath = path.resolve(process.cwd(), "../../.env");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const projectId = process.env.project_id;
const dataset = process.env.BQ_DATASET;
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

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: accessRows } = await client.query(
  `SELECT DISTINCT user_id FROM academy_user_assessment_details`,
);
const dashboardUsers = accessRows.map((r) => r.user_id);

const { rows: unpaidRows } = await client.query(`SELECT academy_user_id FROM unpaid_users`);
const currentlyUnpaid = new Set(unpaidRows.map((r) => r.academy_user_id));

console.log(`Users with dashboard access : ${dashboardUsers.length}`);
console.log(`Currently gated (unpaid_users): ${currentlyUnpaid.size}\n`);

const [bqRows] = await bq.query({
  query: `SELECT user_id, payment_status, name_on_certificate, yog, profile_pic_url
          FROM \`${projectId}.${dataset}.academy_users_basic_details_for_pocs\`
          WHERE user_id IN UNNEST(@ids)`,
  params: { ids: dashboardUsers },
});
const byId = new Map(bqRows.map((r) => [r.user_id, r]));

const tally = {};
let missing = 0;
let newlyGated = 0;
let newlyUnlocked = 0;
let nullStatus = 0;
let noCertName = 0;
let noPic = 0;
let noYog = 0;

for (const userId of dashboardUsers) {
  const row = byId.get(userId);
  if (!row) {
    missing += 1;
    tally["<no row in POCs table>"] = (tally["<no row in POCs table>"] ?? 0) + 1;
    continue;
  }
  const status = row.payment_status ?? "<null>";
  tally[status] = (tally[status] ?? 0) + 1;
  if (row.payment_status == null) nullStatus += 1;
  if (!row.name_on_certificate) noCertName += 1;
  if (!row.profile_pic_url) noPic += 1;
  if (row.yog == null) noYog += 1;

  // Proposed gate: PAID (or absent status) unlocks.
  const wouldBePaid = row.payment_status == null || row.payment_status === "PAID";
  const isPaidToday = !currentlyUnpaid.has(userId);
  if (isPaidToday && !wouldBePaid) newlyGated += 1;
  if (!isPaidToday && wouldBePaid) newlyUnlocked += 1;
}

console.log("payment_status among dashboard users:");
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(24)} ${v}`);
}

console.log(`\nMissing from POCs table   : ${missing}`);
console.log(`Null payment_status       : ${nullStatus}`);
console.log(`\n--- Switching the gate to payment_status ---`);
console.log(`Newly gated (paid -> unpaid) : ${newlyGated}`);
console.log(`Newly unlocked (unpaid -> paid): ${newlyUnlocked}`);
console.log(`\nIdentity coverage among dashboard users:`);
console.log(`  missing name_on_certificate : ${noCertName}`);
console.log(`  missing profile_pic_url     : ${noPic}`);
console.log(`  missing yog                 : ${noYog}`);

await client.end();
