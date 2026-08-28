/**
 * Ensures Neon has the schema required by the z_* BigQuery integration.
 * Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 *
 * Usage (from repo root, with DATABASE_URL in .env):
 *   node artifacts/api-server/ensure-z-schema.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("../../lib/db/node_modules/pg");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  process.env[t.slice(0, eq).trim()] = v;
}

const SQL = `
ALTER TABLE academy_user_nxtmock_details
  ADD COLUMN IF NOT EXISTS attempt_number integer,
  ADD COLUMN IF NOT EXISTS interview_status text;

ALTER TABLE visibility_settings
  ADD COLUMN IF NOT EXISTS release_at timestamptz;

CREATE TABLE IF NOT EXISTS irp_l1_round_wise_summary (
  user_id text PRIMARY KEY,
  hustler_assessment_status text,
  hustler_assessment_score_percentage real,
  hustler_assessment_number text,
  hustler_assessment_attempt_number integer,
  hustler_assessment_attempt_date timestamptz,
  hustler_assessment_theory_section_attempt_status text,
  hustler_assessment_theory_section_score real,
  hustler_assessment_theory_section_score_percentage real,
  hustler_assessment_coding_section_attempt_status text,
  hustler_assessment_coding_section_score real,
  hustler_assessment_coding_section_score_percentage real,
  fe_project_status text,
  fe_project_score_percentage real,
  fe_project_assessment_number text,
  fe_project_attempt_number integer,
  fe_project_attempt_date timestamptz,
  fe_project_react_js_coding_section_attempt_status text,
  fe_project_react_js_coding_section_score real,
  fe_project_react_js_coding_section_score_percentage real,
  nxtmock_status text,
  nxtmock_interview_rating real,
  nxtmock_interview_number text,
  nxtmock_attempt_number integer,
  nxtmock_attempt_date timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);
`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  await pool.query(SQL);
  console.log("Schema ensured: irp_l1_round_wise_summary + nxtmock/visibility columns");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
