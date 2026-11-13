import { sql } from "drizzle-orm";
import { db, pool, academyIrpAssessmentQualificationStatusOutputTable } from "@workspace/db";
import {
  getBigQueryClient,
  isBigQueryConfigured,
  Z_FE_PROJECT_ATTEMPT_TABLE,
  Z_HUSTLER_ATTEMPT_TABLE,
} from "./bigquery";
import { logger } from "./logger";

export const QUALIFICATION_OUTPUT_PROJECT = "kossip-helpers";
export const QUALIFICATION_OUTPUT_DATASET = "academy_student_success_pocs_data_output";
export const QUALIFICATION_OUTPUT_TABLE =
  "academy_irp_2_0_assessment_qualification_status_output";

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const MINUTES_PER_DAY = 24 * 60;

let nextRunHandle: ReturnType<typeof setTimeout> | null = null;
let pushInProgress = false;

export function qualificationOutputTableFq(): string {
  return `${QUALIFICATION_OUTPUT_PROJECT}.${QUALIFICATION_OUTPUT_DATASET}.${QUALIFICATION_OUTPUT_TABLE}`;
}

function sourceDataset(): string {
  const configured = process.env["BQ_DATASET"]?.trim();
  return configured || "academy_student_success_pocs";
}

function zFeMainQualificationQuery(): string {
  const projectId = process.env["project_id"] || QUALIFICATION_OUTPUT_PROJECT;
  const dataset = sourceDataset();
  const fe = `${projectId}.${dataset}.${Z_FE_PROJECT_ATTEMPT_TABLE}`;
  return `
    WITH fe AS (
      SELECT
        CAST(user_id AS STRING) AS user_id,
        COALESCE(
          NULLIF(TRIM(assessment_specific_tag), ''),
          CONCAT('ACADEMY-IRP-2.0_MAIN_L1_FE-Project_', TRIM(assessment_number))
        ) AS assessment_specific_tag,
        COALESCE(
          NULLIF(TRIM(assessment_title), ''),
          NULLIF(TRIM(assessment_name), ''),
          'IRP 2.0 FE Project Main'
        ) AS assessment_title,
        REGEXP_EXTRACT(UPPER(COALESCE(assessment_number, assessment_specific_tag, '')), r'A(\\d+)') AS a_num,
        user_assessment_start_datetime,
        attempt_number,
        CASE
          WHEN SAFE_CAST(REGEXP_EXTRACT(UPPER(COALESCE(assessment_number, assessment_specific_tag, '')), r'A(\\d+)') AS INT64) = 1
            AND user_assessment_score_percentage >= 70 THEN 'QUALIFIED'
          WHEN SAFE_CAST(REGEXP_EXTRACT(UPPER(COALESCE(assessment_number, assessment_specific_tag, '')), r'A(\\d+)') AS INT64) = 2
            AND user_assessment_score_percentage >= 100 THEN 'QUALIFIED'
          WHEN SAFE_CAST(REGEXP_EXTRACT(UPPER(COALESCE(assessment_number, assessment_specific_tag, '')), r'A(\\d+)') AS INT64) BETWEEN 3 AND 6
            AND user_assessment_score_percentage >= 90 THEN 'QUALIFIED'
          WHEN SAFE_CAST(REGEXP_EXTRACT(UPPER(COALESCE(assessment_number, assessment_specific_tag, '')), r'A(\\d+)') AS INT64) >= 7
            AND user_assessment_score_percentage >= 75 THEN 'QUALIFIED'
          WHEN user_assessment_start_datetime IS NOT NULL OR attempt_number IS NOT NULL THEN 'NOT QUALIFIED'
          ELSE 'NOT ATTEMPTED'
        END AS qualification_status
      FROM \`${fe}\`
      WHERE UPPER(COALESCE(assessment_type, '')) = 'MAIN'
        AND user_id IS NOT NULL
    ),
    ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, a_num
          ORDER BY user_assessment_start_datetime DESC NULLS LAST, attempt_number DESC NULLS LAST
        ) AS rn
      FROM fe
      WHERE a_num IS NOT NULL
        AND TRIM(COALESCE(assessment_specific_tag, '')) <> ''
    )
    SELECT
      user_id,
      assessment_specific_tag,
      assessment_title,
      qualification_status
    FROM ranked
    WHERE rn = 1
  `;
}

function zHustlerMainQualificationQuery(): string {
  const projectId = process.env["project_id"] || QUALIFICATION_OUTPUT_PROJECT;
  const dataset = sourceDataset();
  const hustler = `${projectId}.${dataset}.${Z_HUSTLER_ATTEMPT_TABLE}`;
  return `
    WITH hustler AS (
      SELECT
        CAST(user_id AS STRING) AS user_id,
        COALESCE(
          NULLIF(TRIM(assessment_specific_tag), ''),
          CONCAT('ACADEMY-IRP-2.0_MAIN_L1_HUSTLER-ASSESSMENT_', TRIM(assessment_number))
        ) AS assessment_specific_tag,
        COALESCE(
          NULLIF(TRIM(assessment_title), ''),
          NULLIF(TRIM(assessment_name), ''),
          'IRP 2.0 L1 Hustler Assessment'
        ) AS assessment_title,
        REGEXP_EXTRACT(UPPER(COALESCE(assessment_number, assessment_specific_tag, '')), r'A(\\d+)') AS a_num,
        user_assessment_start_datetime,
        attempt_number,
        CASE
          WHEN user_assessment_score_percentage >= 70 THEN 'QUALIFIED'
          WHEN user_assessment_start_datetime IS NOT NULL OR attempt_number IS NOT NULL THEN 'NOT QUALIFIED'
          ELSE 'NOT ATTEMPTED'
        END AS qualification_status
      FROM \`${hustler}\`
      WHERE UPPER(COALESCE(assessment_type, '')) = 'MAIN'
        AND user_id IS NOT NULL
    ),
    ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, a_num
          ORDER BY user_assessment_start_datetime DESC NULLS LAST, attempt_number DESC NULLS LAST
        ) AS rn
      FROM hustler
      WHERE a_num IS NOT NULL
        AND TRIM(COALESCE(assessment_specific_tag, '')) <> ''
    )
    SELECT
      user_id,
      assessment_specific_tag,
      assessment_title,
      qualification_status
    FROM ranked
    WHERE rn = 1
  `;
}

function zMainQualificationQuery(): string {
  return `
    SELECT * FROM (${zHustlerMainQualificationQuery()})
    UNION ALL
    SELECT * FROM (${zFeMainQualificationQuery()})
  `;
}

async function summarizeOutputTable(): Promise<{
  rowCount: number;
  emptyStatus: number;
  byStatus: Array<{ qualification_status: string; n: number }>;
  byAssessment: Array<{ family: string; a_num: string; n: number }>;
}> {
  const bq = getBigQueryClient();
  const target = qualificationOutputTableFq();
  const [summary] = await bq.query({
    query: `SELECT
        COUNT(*) AS n,
        COUNTIF(TRIM(COALESCE(qualification_status, '')) = '') AS empty_status
      FROM \`${target}\``,
  });
  const [statusRows] = await bq.query({
    query: `SELECT qualification_status, COUNT(*) AS n
            FROM \`${target}\`
            GROUP BY qualification_status
            ORDER BY n DESC`,
  });
  const [byAssessment] = await bq.query({
    query: `SELECT
        CASE
          WHEN REGEXP_CONTAINS(UPPER(assessment_specific_tag), r'FE[-_]PROJECT') THEN 'FE'
          ELSE 'HUSTLER'
        END AS family,
        REGEXP_EXTRACT(UPPER(assessment_specific_tag), r'_A(\\d+)\\b') AS a_num,
        COUNT(*) AS n
      FROM \`${target}\`
      GROUP BY 1, 2
      ORDER BY 1, SAFE_CAST(a_num AS INT64)`,
  });
  return {
    rowCount: Number(summary[0]?.n ?? 0),
    emptyStatus: Number(summary[0]?.empty_status ?? 0),
    byStatus: statusRows.map((r) => ({
      qualification_status: String(r.qualification_status ?? ""),
      n: Number(r.n),
    })),
    byAssessment: byAssessment.map((r) => ({
      family: String(r.family),
      a_num: String(r.a_num ?? ""),
      n: Number(r.n),
    })),
  };
}

const NEON_REPLICA_ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS academy_irp_2_0_assessment_qualification_status_output (
  user_id text NOT NULL,
  assessment_specific_tag text NOT NULL,
  assessment_title text NOT NULL,
  qualification_status text NOT NULL,
  first_seen_at timestamptz,
  last_synced_at timestamptz,
  CONSTRAINT academy_irp_qual_status_output_unique UNIQUE (user_id, assessment_specific_tag, assessment_title)
);
ALTER TABLE academy_irp_2_0_assessment_qualification_status_output
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;
ALTER TABLE academy_irp_2_0_assessment_qualification_status_output
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
`;

export async function appendFeMainToBigQuery(): Promise<void> {
  if (!isBigQueryConfigured()) {
    throw new Error("BigQuery is not configured");
  }
  const bq = getBigQueryClient();
  const target = qualificationOutputTableFq();
  const [existing] = await bq.query({
    query: `SELECT COUNT(*) AS n FROM \`${target}\`
            WHERE REGEXP_CONTAINS(UPPER(COALESCE(assessment_specific_tag, '')), r'FE[-_]PROJECT')`,
  });
  if (Number(existing[0]?.n ?? 0) >= 5081) {
    logger.info({ existingFe: Number(existing[0].n) }, "FE MAIN rows already present; skip append");
    return;
  }

  const destination = bq
    .dataset(QUALIFICATION_OUTPUT_DATASET, { projectId: QUALIFICATION_OUTPUT_PROJECT })
    .table(QUALIFICATION_OUTPUT_TABLE);
  const [job] = await bq.createQueryJob({
    query: zFeMainQualificationQuery(),
    destination,
    writeDisposition: "WRITE_APPEND",
  });
  await job.getQueryResults();
}

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && value !== null && "value" in value) {
    return toDate((value as { value: unknown }).value);
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function replicaQualificationOutputToNeon(): Promise<{ rowCount: number }> {
  await db.execute(sql.raw(NEON_REPLICA_ENSURE_SQL));
  const bq = getBigQueryClient();
  const [rows] = await bq.query({
    query: `SELECT user_id, assessment_specific_tag, assessment_title, qualification_status,
                   first_seen_at, last_synced_at
            FROM \`${qualificationOutputTableFq()}\``,
  });
  await pool.query("TRUNCATE academy_irp_2_0_assessment_qualification_status_output");
  const values = rows.map((row) => ({
    userId: String(row.user_id ?? ""),
    assessmentSpecificTag: String(row.assessment_specific_tag ?? ""),
    assessmentTitle: String(row.assessment_title ?? ""),
    qualificationStatus: String(row.qualification_status ?? "NOT ATTEMPTED"),
    firstSeenAt: toDate(row.first_seen_at),
    lastSyncedAt: toDate(row.last_synced_at),
  })).filter((row) => row.userId && row.assessmentSpecificTag);
  for (let i = 0; i < values.length; i += 500) {
    await db.insert(academyIrpAssessmentQualificationStatusOutputTable).values(values.slice(i, i + 500));
  }
  logger.info({ rowCount: values.length }, "Replicated qualification output table into Neon");
  return { rowCount: values.length };
}

/**
 * Rebuilds the output table from z_* MAIN Hustler + FE-Project rows,
 * including access-only NOT ATTEMPTED users and any new students, then
 * copies the same snapshot into Neon.
 */
export async function pushQualificationStatusToBigQuery(): Promise<{
  rowCount: number;
  emptyStatus: number;
  insertedThisRun: number;
  byStatus: Array<{ qualification_status: string; n: number }>;
  byAssessment: Array<{ family: string; a_num: string; n: number }>;
  neonRowCount?: number;
}> {
  if (!isBigQueryConfigured()) {
    throw new Error("BigQuery is not configured");
  }
  const bq = getBigQueryClient();
  const target = qualificationOutputTableFq();
  const stagingId = `${QUALIFICATION_OUTPUT_TABLE}_stg`;
  const stagingFq = `${QUALIFICATION_OUTPUT_PROJECT}.${QUALIFICATION_OUTPUT_DATASET}.${stagingId}`;
  const dataset = bq.dataset(QUALIFICATION_OUTPUT_DATASET, { projectId: QUALIFICATION_OUTPUT_PROJECT });
  const runStartedAt = new Date().toISOString();

  await bq.query({ query: `ALTER TABLE \`${target}\` ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP` });
  await bq.query({ query: `ALTER TABLE \`${target}\` ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP` });
  await bq.query({
    query: `UPDATE \`${target}\`
            SET first_seen_at = COALESCE(first_seen_at, TIMESTAMP '2026-11-11 00:00:00 UTC'),
                last_synced_at = COALESCE(last_synced_at, TIMESTAMP '2026-11-11 00:00:00 UTC')
            WHERE first_seen_at IS NULL OR last_synced_at IS NULL`,
  });

  const staging = dataset.table(stagingId);
  const [loadJob] = await bq.createQueryJob({
    query: zMainQualificationQuery(),
    destination: staging,
    writeDisposition: "WRITE_TRUNCATE",
  });
  await loadJob.getQueryResults();

  await bq.query({
    query: `
      MERGE \`${target}\` T
      USING \`${stagingFq}\` S
      ON T.user_id = S.user_id
         AND T.assessment_specific_tag = S.assessment_specific_tag
         AND T.assessment_title = S.assessment_title
      WHEN MATCHED THEN UPDATE SET
        qualification_status = S.qualification_status,
        last_synced_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT
        (user_id, assessment_specific_tag, assessment_title, qualification_status, first_seen_at, last_synced_at)
        VALUES (S.user_id, S.assessment_specific_tag, S.assessment_title, S.qualification_status,
                CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
    `,
  });

  const [inserted] = await bq.query({
    query: `SELECT COUNT(*) AS n FROM \`${target}\`
            WHERE first_seen_at >= TIMESTAMP(@runStartedAt)`,
    params: { runStartedAt },
  });
  const insertedThisRun = Number(inserted[0]?.n ?? 0);
  const summary = await summarizeOutputTable();
  const neon = await replicaQualificationOutputToNeon();
  logger.info(
    { ...summary, insertedThisRun, neonRowCount: neon.rowCount, table: target },
    "Upserted qualification output from z_* MAIN and replicated to Neon",
  );
  return { ...summary, insertedThisRun, neonRowCount: neon.rowCount };
}

export async function runMorningQualificationOutputSync(): Promise<{
  inboundOk: boolean;
  rowCount: number;
  emptyStatus?: number;
  byStatus?: Array<{ qualification_status: string; n: number }>;
  byAssessment?: Array<{ family: string; a_num: string; n: number }>;
}> {
  if (pushInProgress) {
    logger.warn("Qualification output push already in progress");
    return { inboundOk: false, rowCount: 0 };
  }
  pushInProgress = true;
  try {
    const pushed = await pushQualificationStatusToBigQuery();
    logger.info(
      { ...pushed, table: qualificationOutputTableFq() },
      "Morning qualification output sync finished",
    );
    return { inboundOk: true, ...pushed };
  } finally {
    pushInProgress = false;
  }
}

function msUntilNextIstTime(hours: number, minutes: number): number {
  const targetUtc =
    (((hours * 60 + minutes - IST_OFFSET_MINUTES) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const now = new Date();
  const nowMinOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
  const nowSec = now.getUTCSeconds();
  const deltaMin = targetUtc - nowMinOfDay;
  if (deltaMin > 0) return (deltaMin * 60 - nowSec) * 1000;
  const minsUntilMidnight = MINUTES_PER_DAY - nowMinOfDay;
  return ((minsUntilMidnight + targetUtc) * 60 - nowSec) * 1000;
}

/**
 * Replaces the BigQuery qualification output table every day at 05:00 IST
 * from z_* MAIN Hustler and FE-Project tables.
 */
export function startQualificationOutputPushScheduler(): void {
  if (!isBigQueryConfigured()) {
    logger.warn("Qualification output push scheduler not started: BigQuery is not configured");
    return;
  }

  const scheduleNext = () => {
    const delay = msUntilNextIstTime(5, 0);
    const nextRunAt = new Date(Date.now() + delay).toISOString();
    if (nextRunHandle) clearTimeout(nextRunHandle);
    nextRunHandle = setTimeout(() => {
      runMorningQualificationOutputSync()
        .catch((err) => logger.error({ err }, "Scheduled qualification output sync errored"))
        .finally(scheduleNext);
    }, delay);
    logger.info({ nextRunAt, minutesUntil: Math.round(delay / 60000) }, "Next qualification output push at 05:00 IST");
  };

  scheduleNext();
}
