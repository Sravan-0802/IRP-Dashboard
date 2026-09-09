/**
 * Adds the POCs columns to `academy_user_basic_details` and syncs every row
 * from BigQuery `academy_users_basic_details_for_pocs` into it.
 *
 * Usage: node sync-pocs-basic-details.mjs
 */
import fs from "fs";
import path from "path";
import { BigQuery } from "@google-cloud/bigquery";

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

console.log("Adding POCs columns (idempotent)…");
await client.query(`
ALTER TABLE academy_user_basic_details
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS name_on_certificate text,
  ADD COLUMN IF NOT EXISTS yog integer,
  ADD COLUMN IF NOT EXISTS lpoad timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS payment_plan text,
  ADD COLUMN IF NOT EXISTS irp_eligible_status text,
  ADD COLUMN IF NOT EXISTS profile_pic_url text;
`);
console.log("Columns ready.\n");

console.log("Fetching from BigQuery…");
const [rows] = await bq.query({
  query: `SELECT user_id, first_name, last_name, name_on_certificate, yog, lpoad,
                 payment_status, payment_plan, irp_eligible_status, profile_pic_url
          FROM \`${projectId}.${dataset}.academy_users_basic_details_for_pocs\``,
});
console.log(`Fetched ${rows.length} rows.\n`);

const str = (v) => (v === null || v === undefined ? null : String(v));
const num = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));
const date = (v) => {
  if (v === null || v === undefined) return null;
  const raw = typeof v === "object" && v !== null && "value" in v ? v.value : v;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
};
const paymentStatus = (v) => {
  const s = str(v)?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (s === "NOT_PAID" || s === "PAYMENT_UNPAID") return "UNPAID";
  if (s === "PAYMENT_PAID" || s === "FULLY_PAID") return "PAID";
  if (s === "PARTIAL" || s === "PARTIAL_PAID") return "PARTIALLY_PAID";
  return s;
};
const displayName = (r) => {
  const cert = str(r.name_on_certificate)?.trim();
  if (cert) return cert;
  const joined = [str(r.first_name)?.trim(), str(r.last_name)?.trim()].filter(Boolean).join(" ");
  return joined || null;
};

// Dedupe on user_id (BQ has 7 dupes across 45,195 rows).
const byId = new Map();
for (const r of rows) {
  if (r.user_id == null || String(r.user_id).trim() === "") continue;
  byId.set(String(r.user_id), r);
}
const mapped = [...byId.values()];
console.log(`${mapped.length} unique users after dedupe.\n`);

const COLS = [
  "user_id", "user_name", "first_name", "last_name", "name_on_certificate",
  "yog", "lpoad", "payment_status", "payment_plan", "irp_eligible_status",
  "profile_pic_url", "synced_at",
];
const now = new Date();
const BATCH = 500;
let done = 0;

for (let i = 0; i < mapped.length; i += BATCH) {
  const batch = mapped.slice(i, i + BATCH);
  const values = [];
  const placeholders = batch.map((r, idx) => {
    values.push(
      String(r.user_id), displayName(r), str(r.first_name), str(r.last_name),
      str(r.name_on_certificate), num(r.yog), date(r.lpoad), paymentStatus(r.payment_status),
      str(r.payment_plan), str(r.irp_eligible_status), str(r.profile_pic_url), now,
    );
    return `(${COLS.map((_, c) => `$${idx * COLS.length + c + 1}`).join(", ")})`;
  });

  await client.query(
    `INSERT INTO academy_user_basic_details (${COLS.map((c) => `"${c}"`).join(", ")})
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (user_id) DO UPDATE SET
       user_name = excluded.user_name,
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       name_on_certificate = excluded.name_on_certificate,
       yog = excluded.yog,
       lpoad = excluded.lpoad,
       payment_status = excluded.payment_status,
       payment_plan = excluded.payment_plan,
       irp_eligible_status = excluded.irp_eligible_status,
       profile_pic_url = excluded.profile_pic_url,
       synced_at = excluded.synced_at`,
    values,
  );
  done += batch.length;
  if (done % 5000 === 0 || done === mapped.length) console.log(`  upserted ${done}/${mapped.length}`);
}

const { rows: verify } = await client.query(`
  SELECT COUNT(*) AS total,
         COUNT(name_on_certificate) AS with_cert_name,
         COUNT(yog) AS with_yog,
         COUNT(profile_pic_url) AS with_pic,
         COUNT(payment_status) AS with_payment_status
  FROM academy_user_basic_details`);
console.log("\nPostgres mirror now holds:", verify[0]);

const { rows: dist } = await client.query(`
  SELECT payment_status, COUNT(*) AS n FROM academy_user_basic_details
  GROUP BY 1 ORDER BY n DESC`);
console.log("\npayment_status in Postgres:");
for (const r of dist) console.log(`  ${String(r.payment_status).padEnd(20)} ${r.n}`);

await client.end();
console.log("\nDone.");
