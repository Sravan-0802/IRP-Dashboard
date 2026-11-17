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

const MERGE_KEY = `
  T.user_id = S.user_id
  AND T.assessment_specific_tag = S.assessment_specific_tag
  AND T.assessment_title = S.assessment_title
`;

/**
 * Upserts only user_id, assessment_specific_tag, assessment_title, qualification_status.
 * Existing extra BigQuery columns are left unchanged. New keys are inserted with
 * those four fields only.
 */
export async function pushQualificationStatusToBigQuery(): Promise<{
  rowCount: number;
  emptyStatus: number;
  insertedThisRun: number;
  updatedThisRun: number;
  byStatus: Array<{ qualification_status: string; n: number }>;
  byAssessment: Array<{ family: string; a_num: string; n: number }>;
}> {
  if (!isBigQueryConfigured()) {
    throw new Error("BigQuery is not configured");
  }
  const bq = getBigQueryClient();
  const target = qualificationOutputTableFq();
  const stagingId = `${QUALIFICATION_OUTPUT_TABLE}_stg`;
  const stagingFq = `${QUALIFICATION_OUTPUT_PROJECT}.${QUALIFICATION_OUTPUT_DATASET}.${stagingId}`;
  const dataset = bq.dataset(QUALIFICATION_OUTPUT_DATASET, { projectId: QUALIFICATION_OUTPUT_PROJECT });

  const staging = dataset.table(stagingId);
  const [loadJob] = await bq.createQueryJob({
    query: zMainQualificationQuery(),
    destination: staging,
    writeDisposition: "WRITE_TRUNCATE",
  });
  await loadJob.getQueryResults();

  const [pending] = await bq.query({
    query: `SELECT
        COUNTIF(T.user_id IS NULL) AS to_insert,
        COUNTIF(T.user_id IS NOT NULL AND T.qualification_status IS DISTINCT FROM S.qualification_status) AS to_update
      FROM \`${stagingFq}\` S
      LEFT JOIN \`${target}\` T
        ON ${MERGE_KEY}`,
  });
  const insertedThisRun = Number(pending[0]?.to_insert ?? 0);
  const updatedThisRun = Number(pending[0]?.to_update ?? 0);

  await bq.query({
    query: `
      MERGE \`${target}\` T
      USING \`${stagingFq}\` S
      ON ${MERGE_KEY}
      WHEN MATCHED AND T.qualification_status IS DISTINCT FROM S.qualification_status THEN
        UPDATE SET qualification_status = S.qualification_status
      WHEN NOT MATCHED THEN INSERT
        (user_id, assessment_specific_tag, assessment_title, qualification_status)
        VALUES (S.user_id, S.assessment_specific_tag, S.assessment_title, S.qualification_status)
    `,
  });

  const summary = await summarizeOutputTable();
  logger.info(
    { ...summary, insertedThisRun, updatedThisRun, table: target },
    "Upserted qualification output (4 columns only) from z_* MAIN",
  );
  return { ...summary, insertedThisRun, updatedThisRun };
}

export async function runMorningQualificationOutputSync(): Promise<{
  inboundOk: boolean;
  rowCount: number;
  emptyStatus?: number;
  insertedThisRun?: number;
  updatedThisRun?: number;
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
 * Upserts the four qualification columns every day at 05:00 IST from z_* MAIN
 * Hustler and FE-Project tables. Extra BigQuery columns are never dropped.
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
