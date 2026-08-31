/**
 * Sync the four IRP 2.0 L1 z_* BigQuery tables into production Neon.
 *
 *   z_academy_irp_2_0_l1_hustler_assessment_user_attempt_details
 *   z_academy_irp_2_0_l1_fe_project_user_attempt_details
 *     → academy_user_assessment_details
 *   z_academy_irp_2_0_l1_nxtmock_user_attempt_details
 *     → academy_user_nxtmock_details
 *   z_academy_irp_2_0_l1_user_round_wise_summary
 *     → irp_l1_round_wise_summary
 *
 * Usage (repo root .env with DATABASE_URL + BQ credentials):
 *   node artifacts/api-server/sync-z-academy.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BigQuery } from "@google-cloud/bigquery";

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

const projectId = process.env.project_id;
const dataset = process.env.BQ_DATASET || "academy_student_success_pocs";
const privateKey = (process.env.private_key ?? "").replace(/\\n/g, "\n");
const BATCH = 200;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
if (!projectId || !process.env.client_email || !privateKey) {
  throw new Error("BigQuery env required: project_id, client_email, private_key");
}

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

function toInt(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function toReal(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toStr(v) {
  return v == null ? null : String(v);
}
function toDate(v) {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "object" && v !== null && "value" in v) return toDate(v.value);
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}
function maxFromPct(score, pct) {
  if (score == null || pct == null || !(pct > 0)) return null;
  const max = score / (pct / 100);
  return Number.isFinite(max) ? max : null;
}
function fq(table) {
  return `\`${projectId}.${dataset}.${table}\``;
}
const attemptFilter = (col) =>
  `UPPER(COALESCE(assessment_type, '')) = 'MAIN'
    AND (${col} IN ('QUALIFIED', 'NOT QUALIFIED') OR attempt_number IS NOT NULL)`;
const nxtmockFilter =
  `UPPER(COALESCE(interview_program, '')) = 'MAIN'
    AND (interview_status IN ('QUALIFIED', 'NOT QUALIFIED') OR attempt_number IS NOT NULL)`;

async function recordStatus(tableName, status, rowCount, durationMs, error) {
  const now = new Date();
  await pool.query(
    `INSERT INTO bigquery_sync_status (table_name, status, row_count, duration_ms, error, last_synced_at, updated_at)
     VALUES ($1,$2,$3,$4,$5, CASE WHEN $2='success' THEN $6 ELSE NULL END, $6)
     ON CONFLICT (table_name) DO UPDATE SET
       status = EXCLUDED.status,
       row_count = EXCLUDED.row_count,
       duration_ms = EXCLUDED.duration_ms,
       error = EXCLUDED.error,
       last_synced_at = CASE WHEN EXCLUDED.status='success' THEN EXCLUDED.last_synced_at ELSE bigquery_sync_status.last_synced_at END,
       updated_at = EXCLUDED.updated_at`,
    [tableName, status, rowCount, durationMs, error, now],
  );
}

async function syncHustlerAndFe() {
  const start = Date.now();
  const [hustlerRows] = await bq.query({
    query: `SELECT
      user_id, assessment_specific_tag, assessment_title, assessment_type, assessment_level,
      assessment_name, assessment_number, primary_organisation_assessment_id,
      assessment_start_datetime, user_assessment_start_datetime,
      assessment_actual_score, user_assessment_score, user_assessment_score_percentage,
      theory_section_attempt_status, theory_section_score, theory_section_score_percentage,
      coding_section_attempt_status, coding_section_score, coding_section_score_percentage,
      assessment_status, attempt_number
    FROM ${fq("z_academy_irp_2_0_l1_hustler_assessment_user_attempt_details")}
    WHERE ${attemptFilter("assessment_status")}`,
  });
  const [feRows] = await bq.query({
    query: `SELECT
      user_id, assessment_specific_tag, assessment_title, assessment_type, assessment_level,
      assessment_name, assessment_number, primary_organisation_assessment_id,
      assessment_start_datetime, user_assessment_start_datetime,
      assessment_actual_score, user_assessment_score, user_assessment_score_percentage,
      react_js_coding_section_attempt_status, react_js_coding_section_score,
      react_js_coding_section_score_percentage, assessment_status, attempt_number
    FROM ${fq("z_academy_irp_2_0_l1_fe_project_user_attempt_details")}
    WHERE ${attemptFilter("assessment_status")}`,
  });

  const mapped = [];
  for (const r of hustlerRows) {
    if (!r.user_id || !r.primary_organisation_assessment_id) continue;
    const theoryScore = toReal(r.theory_section_score);
    const theoryPct = toReal(r.theory_section_score_percentage);
    const codingScore = toReal(r.coding_section_score);
    const codingPct = toReal(r.coding_section_score_percentage);
    const cycleParts = [toStr(r.assessment_number)].filter(Boolean);
    mapped.push([
      String(r.user_id),
      String(r.primary_organisation_assessment_id),
      toStr(r.assessment_title),
      toStr(r.assessment_specific_tag),
      toStr(r.assessment_level),
      cycleParts.length ? cycleParts.join("_") : null,
      toDate(r.assessment_start_datetime),
      toDate(r.user_assessment_start_datetime),
      maxFromPct(theoryScore, theoryPct),
      theoryScore,
      maxFromPct(codingScore, codingPct),
      codingScore,
      null,
      null,
      toReal(r.assessment_actual_score),
      toReal(r.user_assessment_score),
      toInt(r.attempt_number),
      toStr(r.assessment_status),
    ]);
  }
  for (const r of feRows) {
    if (!r.user_id || !r.primary_organisation_assessment_id) continue;
    const feScore = toReal(r.react_js_coding_section_score);
    const fePct = toReal(r.react_js_coding_section_score_percentage);
    const feMax = maxFromPct(feScore, fePct) ?? toReal(r.assessment_actual_score);
    const cycleParts = [toStr(r.assessment_number)].filter(Boolean);
    mapped.push([
      String(r.user_id),
      String(r.primary_organisation_assessment_id),
      toStr(r.assessment_title),
      toStr(r.assessment_specific_tag),
      toStr(r.assessment_level),
      cycleParts.length ? cycleParts.join("_") : null,
      toDate(r.assessment_start_datetime),
      toDate(r.user_assessment_start_datetime),
      null,
      null,
      null,
      null,
      feMax,
      feScore,
      toReal(r.assessment_actual_score),
      toReal(r.user_assessment_score),
      toInt(r.attempt_number),
      toStr(r.assessment_status),
    ]);
  }

  // Prefer higher attempt_number for same user+org assessment.
  const byKey = new Map();
  for (const row of mapped) {
    const key = `${row[0]}:${row[1]}`;
    const prev = byKey.get(key);
    if (!prev || (row[16] ?? -1) >= (prev[16] ?? -1)) byKey.set(key, row);
  }
  const deduped = [...byKey.values()];

  for (let i = 0; i < deduped.length; i += BATCH) {
    const batch = deduped.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let p = 1;
    for (const row of batch) {
      values.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},NOW())`,
      );
      params.push(...row);
    }
    await pool.query(
      `INSERT INTO academy_user_assessment_details (
        user_id, organisation_assessment_id, assessment_title, assessment_tag,
        level, cycle, assessment_start_datetime, user_assessment_start_datetime,
        mcq_section_max_score, mcq_user_section_score,
        coding_section_max_score, coding_user_section_score,
        fe_section_max_score, fe_user_section_score,
        assessment_total_score, assessment_user_score,
        attempt_number, assessment_status, synced_at
      ) VALUES ${values.join(",")}
      ON CONFLICT (user_id, organisation_assessment_id) DO UPDATE SET
        assessment_title = EXCLUDED.assessment_title,
        assessment_tag = EXCLUDED.assessment_tag,
        level = EXCLUDED.level,
        cycle = EXCLUDED.cycle,
        assessment_start_datetime = EXCLUDED.assessment_start_datetime,
        user_assessment_start_datetime = EXCLUDED.user_assessment_start_datetime,
        mcq_section_max_score = EXCLUDED.mcq_section_max_score,
        mcq_user_section_score = EXCLUDED.mcq_user_section_score,
        coding_section_max_score = EXCLUDED.coding_section_max_score,
        coding_user_section_score = EXCLUDED.coding_user_section_score,
        fe_section_max_score = EXCLUDED.fe_section_max_score,
        fe_user_section_score = EXCLUDED.fe_user_section_score,
        assessment_total_score = EXCLUDED.assessment_total_score,
        assessment_user_score = EXCLUDED.assessment_user_score,
        attempt_number = EXCLUDED.attempt_number,
        assessment_status = EXCLUDED.assessment_status,
        synced_at = NOW()`,
      params,
    );
  }

  const durationMs = Date.now() - start;
  await recordStatus("academy_user_assessment_details", "success", deduped.length, durationMs, null);
  return {
    hustlerFetched: hustlerRows.length,
    feFetched: feRows.length,
    upserted: deduped.length,
    durationMs,
  };
}

function parseSkills(raw) {
  const empty = {
    selfIntro: null,
    jsCoding: null,
    js: null,
    css: null,
    html: null,
    react: null,
  };
  if (raw == null) return empty;
  let obj;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return empty;
  }
  const read = (...keys) => {
    for (const k of keys) {
      const v = obj[k] ?? obj[k.toLowerCase()] ?? obj[k.toUpperCase()];
      const n = toReal(v);
      if (n != null) return Math.round(n);
    }
    return null;
  };
  return {
    selfIntro: read("SELF_INTRO", "self_intro"),
    jsCoding: read("JAVASCRIPT_CODING", "javascript_coding"),
    js: read("JAVASCRIPT", "javascript"),
    css: read("CSS", "css"),
    html: read("HTML", "html"),
    react: read("REACT_JS", "react_js", "REACT"),
  };
}

async function syncNxtmock() {
  const start = Date.now();
  const [rows] = await bq.query({
    query: `SELECT
      user_id, interview_id, interview_attempt_id, interview_tag,
      interview_attempt_start_datetime, avg_user_interview_rating, user_interview_overall_rating,
      interview_program, interview_level, interview_name, interview_number,
      interview_status, attempt_number, section_wise_rating_json
    FROM ${fq("z_academy_irp_2_0_l1_nxtmock_user_attempt_details")}
    WHERE ${nxtmockFilter}`,
  });

  const byKey = new Map();
  for (const r of rows) {
    if (!r.user_id) continue;
    const interviewId =
      toStr(r.interview_id) ??
      toStr(r.interview_attempt_id) ??
      `${r.user_id}:${r.interview_number ?? "unknown"}`;
    const skills = parseSkills(r.section_wise_rating_json);
    const row = [
      String(r.user_id),
      interviewId,
      toStr(r.interview_tag) ?? toStr(r.interview_name),
      toStr(r.interview_program),
      toStr(r.interview_level),
      toStr(r.interview_number),
      skills.selfIntro,
      skills.jsCoding,
      skills.js,
      skills.css,
      skills.html,
      skills.react,
      toReal(r.avg_user_interview_rating),
      toInt(r.attempt_number),
      toStr(r.interview_status),
    ];
    const key = `${row[0]}:${row[1]}`;
    const prev = byKey.get(key);
    if (!prev || (row[13] ?? -1) >= (prev[13] ?? -1)) byKey.set(key, row);
  }
  const mapped = [...byKey.values()];

  for (let i = 0; i < mapped.length; i += BATCH) {
    const batch = mapped.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let p = 1;
    for (const row of batch) {
      values.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},NOW())`,
      );
      params.push(...row);
    }
    await pool.query(
      `INSERT INTO academy_user_nxtmock_details (
        user_id, interview_id, interview_title, exam_type, level, cycle,
        self_intro_rating, javascript_coding_rating, javascript_rating,
        css_rating, html_rating, react_js_rating, average_rating,
        attempt_number, interview_status, synced_at
      ) VALUES ${values.join(",")}
      ON CONFLICT (user_id, interview_id) DO UPDATE SET
        interview_title = EXCLUDED.interview_title,
        exam_type = EXCLUDED.exam_type,
        level = EXCLUDED.level,
        cycle = EXCLUDED.cycle,
        self_intro_rating = EXCLUDED.self_intro_rating,
        javascript_coding_rating = EXCLUDED.javascript_coding_rating,
        javascript_rating = EXCLUDED.javascript_rating,
        css_rating = EXCLUDED.css_rating,
        html_rating = EXCLUDED.html_rating,
        react_js_rating = EXCLUDED.react_js_rating,
        average_rating = EXCLUDED.average_rating,
        attempt_number = EXCLUDED.attempt_number,
        interview_status = EXCLUDED.interview_status,
        synced_at = NOW()`,
      params,
    );
  }

  const durationMs = Date.now() - start;
  await recordStatus("academy_user_nxtmock_details", "success", mapped.length, durationMs, null);
  return { fetched: rows.length, upserted: mapped.length, durationMs };
}

async function syncRoundWise() {
  const start = Date.now();
  const [rows] = await bq.query({
    query: `SELECT
      user_id,
      hustler_assessment_status, hustler_assessment_score_percentage, hustler_assessment_number,
      hustler_assessment_attempt_number, hustler_assessment_attempt_date,
      hustler_assessment_theory_section_attempt_status, hustler_assessment_theory_section_score,
      hustler_assessment_theory_section_score_percentage,
      hustler_assessment_coding_section_attempt_status, hustler_assessment_coding_section_score,
      hustler_assessment_coding_section_score_percentage,
      fe_project_status, fe_project_score_percentage, fe_project_assessment_number,
      fe_project_attempt_number, fe_project_attempt_date,
      fe_project_react_js_coding_section_attempt_status, fe_project_react_js_coding_section_score,
      fe_project_react_js_coding_section_score_percentage,
      nxtmock_status, nxtmock_interivew_rating, nxtmock_interview_number,
      nxtmock_attempt_number, nxtmock_attempt_date
    FROM ${fq("z_academy_irp_2_0_l1_user_round_wise_summary")}`,
  });

  const byUser = new Map();
  for (const r of rows) {
    if (!r.user_id) continue;
    byUser.set(String(r.user_id), [
      String(r.user_id),
      toStr(r.hustler_assessment_status),
      toReal(r.hustler_assessment_score_percentage),
      toStr(r.hustler_assessment_number),
      toInt(r.hustler_assessment_attempt_number),
      toDate(r.hustler_assessment_attempt_date),
      toStr(r.hustler_assessment_theory_section_attempt_status),
      toReal(r.hustler_assessment_theory_section_score),
      toReal(r.hustler_assessment_theory_section_score_percentage),
      toStr(r.hustler_assessment_coding_section_attempt_status),
      toReal(r.hustler_assessment_coding_section_score),
      toReal(r.hustler_assessment_coding_section_score_percentage),
      toStr(r.fe_project_status),
      toReal(r.fe_project_score_percentage),
      toStr(r.fe_project_assessment_number),
      toInt(r.fe_project_attempt_number),
      toDate(r.fe_project_attempt_date),
      toStr(r.fe_project_react_js_coding_section_attempt_status),
      toReal(r.fe_project_react_js_coding_section_score),
      toReal(r.fe_project_react_js_coding_section_score_percentage),
      toStr(r.nxtmock_status),
      toReal(r.nxtmock_interivew_rating),
      toStr(r.nxtmock_interview_number),
      toInt(r.nxtmock_attempt_number),
      toDate(r.nxtmock_attempt_date),
    ]);
  }
  const mapped = [...byUser.values()];

  for (let i = 0; i < mapped.length; i += BATCH) {
    const batch = mapped.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let p = 1;
    for (const row of batch) {
      values.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},NOW())`,
      );
      params.push(...row);
    }
    await pool.query(
      `INSERT INTO irp_l1_round_wise_summary (
        user_id,
        hustler_assessment_status, hustler_assessment_score_percentage, hustler_assessment_number,
        hustler_assessment_attempt_number, hustler_assessment_attempt_date,
        hustler_assessment_theory_section_attempt_status, hustler_assessment_theory_section_score,
        hustler_assessment_theory_section_score_percentage,
        hustler_assessment_coding_section_attempt_status, hustler_assessment_coding_section_score,
        hustler_assessment_coding_section_score_percentage,
        fe_project_status, fe_project_score_percentage, fe_project_assessment_number,
        fe_project_attempt_number, fe_project_attempt_date,
        fe_project_react_js_coding_section_attempt_status, fe_project_react_js_coding_section_score,
        fe_project_react_js_coding_section_score_percentage,
        nxtmock_status, nxtmock_interview_rating, nxtmock_interview_number,
        nxtmock_attempt_number, nxtmock_attempt_date, synced_at
      ) VALUES ${values.join(",")}
      ON CONFLICT (user_id) DO UPDATE SET
        hustler_assessment_status = EXCLUDED.hustler_assessment_status,
        hustler_assessment_score_percentage = EXCLUDED.hustler_assessment_score_percentage,
        hustler_assessment_number = EXCLUDED.hustler_assessment_number,
        hustler_assessment_attempt_number = EXCLUDED.hustler_assessment_attempt_number,
        hustler_assessment_attempt_date = EXCLUDED.hustler_assessment_attempt_date,
        hustler_assessment_theory_section_attempt_status = EXCLUDED.hustler_assessment_theory_section_attempt_status,
        hustler_assessment_theory_section_score = EXCLUDED.hustler_assessment_theory_section_score,
        hustler_assessment_theory_section_score_percentage = EXCLUDED.hustler_assessment_theory_section_score_percentage,
        hustler_assessment_coding_section_attempt_status = EXCLUDED.hustler_assessment_coding_section_attempt_status,
        hustler_assessment_coding_section_score = EXCLUDED.hustler_assessment_coding_section_score,
        hustler_assessment_coding_section_score_percentage = EXCLUDED.hustler_assessment_coding_section_score_percentage,
        fe_project_status = EXCLUDED.fe_project_status,
        fe_project_score_percentage = EXCLUDED.fe_project_score_percentage,
        fe_project_assessment_number = EXCLUDED.fe_project_assessment_number,
        fe_project_attempt_number = EXCLUDED.fe_project_attempt_number,
        fe_project_attempt_date = EXCLUDED.fe_project_attempt_date,
        fe_project_react_js_coding_section_attempt_status = EXCLUDED.fe_project_react_js_coding_section_attempt_status,
        fe_project_react_js_coding_section_score = EXCLUDED.fe_project_react_js_coding_section_score,
        fe_project_react_js_coding_section_score_percentage = EXCLUDED.fe_project_react_js_coding_section_score_percentage,
        nxtmock_status = EXCLUDED.nxtmock_status,
        nxtmock_interview_rating = EXCLUDED.nxtmock_interview_rating,
        nxtmock_interview_number = EXCLUDED.nxtmock_interview_number,
        nxtmock_attempt_number = EXCLUDED.nxtmock_attempt_number,
        nxtmock_attempt_date = EXCLUDED.nxtmock_attempt_date,
        synced_at = NOW()`,
      params,
    );
  }

  const durationMs = Date.now() - start;
  await recordStatus("irp_l1_round_wise_summary", "success", mapped.length, durationMs, null);
  return { fetched: rows.length, upserted: mapped.length, durationMs };
}

async function main() {
  console.log(
    JSON.stringify({
      projectId,
      dataset,
      dbHost: (process.env.DATABASE_URL.match(/@([^/]+)/) || [])[1] || null,
    }),
  );

  // Keep serial sequences healthy for upsert tables.
  for (const table of ["academy_user_assessment_details", "academy_user_nxtmock_details"]) {
    try {
      await pool.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
      );
    } catch (err) {
      console.warn("sequence realign skipped", table, err.message);
    }
  }

  const assessments = await syncHustlerAndFe();
  console.log("assessments (hustler+fe)", assessments);
  const nxtmock = await syncNxtmock();
  console.log("nxtmock", nxtmock);
  const roundWise = await syncRoundWise();
  console.log("round_wise", roundWise);

  const counts = await pool.query(`
    SELECT 'academy_user_assessment_details' AS table_name, COUNT(*)::int AS rows FROM academy_user_assessment_details
    UNION ALL
    SELECT 'academy_user_nxtmock_details', COUNT(*)::int FROM academy_user_nxtmock_details
    UNION ALL
    SELECT 'irp_l1_round_wise_summary', COUNT(*)::int FROM irp_l1_round_wise_summary
  `);
  console.log(JSON.stringify({ neonCounts: counts.rows }, null, 2));
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
