import { readFileSync, writeFileSync } from "node:fs";
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
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[t.slice(0, eq).trim()] = v;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(`
  SELECT candidate_id, interview_id, interview_date, interview_start_time,
         part1_avg, part2_avg, part3_avg, communication_rating, final_score, clearance_status
  FROM human_interview_results
  WHERE clearance_status = 'Cleared' AND final_score IS NOT NULL
  ORDER BY candidate_id, interview_date DESC, interview_start_time DESC`);
const summary = await pool.query(`
  SELECT clearance_status, COUNT(*) attempts, COUNT(DISTINCT candidate_id) students
  FROM human_interview_results GROUP BY 1 ORDER BY 1`);
console.table(summary.rows);
const cols = Object.keys(rows[0] ?? {});
const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => r[c] ?? "").join(","))].join("\n") + "\n";
writeFileSync(resolve(root, "artifacts/cleared-human-interviews.csv"), csv);
console.log("cleared attempts:", rows.length, "unique students:", new Set(rows.map((r) => r.candidate_id)).size);
await pool.end();
