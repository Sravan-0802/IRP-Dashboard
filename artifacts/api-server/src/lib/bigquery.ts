import { BigQuery } from "@google-cloud/bigquery";
import { logger } from "./logger";

let cachedClient: BigQuery | null = null;

/**
 * Returns true when all required Google service-account env vars are present.
 */
export function isBigQueryConfigured(): boolean {
  return Boolean(
    process.env["project_id"] &&
      process.env["private_key"] &&
      process.env["client_email"]
  );
}

/**
 * Lazily constructs a BigQuery client from the service-account secrets in env.
 * Credentials are supplied inline (no key file on disk).
 */
export function getBigQueryClient(): BigQuery {
  if (cachedClient) return cachedClient;

  if (!isBigQueryConfigured()) {
    throw new Error(
      "BigQuery is not configured. Missing one of: project_id, private_key, client_email."
    );
  }

  const privateKey = (process.env["private_key"] ?? "").replace(/\\n/g, "\n");

  cachedClient = new BigQuery({
    projectId: process.env["project_id"],
    credentials: {
      type: "service_account",
      project_id: process.env["project_id"],
      private_key_id: process.env["private_key_id"],
      private_key: privateKey,
      client_email: process.env["client_email"],
      client_id: process.env["client_id"],
      token_uri: process.env["token_uri"] ?? "https://oauth2.googleapis.com/token",
    } as Record<string, string>,
  });

  return cachedClient;
}

const BASIC_DETAILS_TABLE = "academy_users_basic_details_for_irp_portal";
const COURSE_PROGRESS_TABLE = "academy_users_course_progress_data_for_irp_portal";
/** Physical copy in the portal dataset (preferred — same pattern as basic details / progress). */
const ASSESSMENT_PHYSICAL_TABLE = "academy_users_irp_main_assessment_details_for_irp_portal";
/** View over retention_academy_analytics — requires access to the underlying table. */
const ASSESSMENT_VIEW_TABLE = "y_academy_users_irp_main_assessment_details_for_irp_portal";
/** Physical copy in the portal dataset (preferred). */
const NXTMOCK_PHYSICAL_TABLE = "academy_users_irp_main_nxtmock_details_for_irp_portal";
/** View — AI Mock Interview ratings per user. */
const NXTMOCK_VIEW_TABLE = "y_academy_users_irp_main_nxtmock_details_for_irp_portal";

const ASSESSMENT_SELECT = `SELECT
      user_id, organisation_assessment_id, assessment_title,
      assessment_tag_str_extracted, level, cycle,
      assessment_start_datetime, assessment_end_datetime, user_assesment_start_datetime,
      mcq_section_max_score, mcq_user_section_score, mcq_user_attempt_duration_in_mins,
      coding_section_max_score, coding_user_section_score, coding_user_attempt_duration_in_mins,
      fe_section_max_score, fe_user_section_score, fe_user_attempt_duration_in_mins,
      assessment_total_score, assessment_user_score`;

function assessmentTableCandidates(): string[] {
  const configured = process.env["BQ_ASSESSMENT_TABLE"]?.trim();
  const candidates = [
    configured,
    ASSESSMENT_PHYSICAL_TABLE,
    ASSESSMENT_VIEW_TABLE,
  ].filter((v): v is string => Boolean(v));
  return [...new Set(candidates)];
}

/**
 * Picks the first assessment table the service account can actually query.
 * Prefers a physical copy in the portal dataset; falls back to the view.
 */
async function resolveAssessmentTable(bq: BigQuery, dataset: string): Promise<string> {
  const projectId = process.env["project_id"];
  let lastError: Error | null = null;

  for (const table of assessmentTableCandidates()) {
    try {
      await bq.query({
        query: `SELECT 1 FROM \`${projectId}.${dataset}.${table}\` LIMIT 1`,
      });
      logger.info({ table, dataset }, "Resolved BigQuery assessment table");
      return table;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ table, err: lastError.message }, "Assessment table not queryable");
    }
  }

  throw new Error(
    `No queryable assessment table found in ${dataset}. ` +
      `Ask a GCP admin to grant read access on retention_academy_analytics.y_academy_users_irp_assessment_details ` +
      `or materialize academy_users_irp_main_assessment_details_for_irp_portal into ${dataset}. ` +
      `Last error: ${lastError?.message ?? "unknown"}`
  );
}

/**
 * Resolves the BigQuery dataset that holds the IRP portal tables.
 * Prefers the BQ_DATASET env var; otherwise auto-discovers by scanning
 * datasets for the known table names.
 */
async function resolveDataset(bq: BigQuery): Promise<string> {
  const configured = process.env["BQ_DATASET"];
  if (configured && configured.trim()) return configured.trim();

  const [datasets] = await bq.getDatasets();
  for (const ds of datasets) {
    if (!ds.id) continue;
    const [tables] = await ds.getTables();
    const ids = tables.map((t) => t.id);
    if (
      ids.includes(BASIC_DETAILS_TABLE) ||
      ids.includes(COURSE_PROGRESS_TABLE) ||
      ids.includes(ASSESSMENT_PHYSICAL_TABLE) ||
      ids.includes(ASSESSMENT_VIEW_TABLE) ||
      ids.includes(NXTMOCK_PHYSICAL_TABLE) ||
      ids.includes(NXTMOCK_VIEW_TABLE) ||
      ids.includes("z_academy_irp_2_0_l1_user_round_wise_summary")
    ) {
      logger.info({ dataset: ds.id }, "Auto-discovered BigQuery dataset for IRP tables");
      return ds.id;
    }
  }

  throw new Error(
    "Could not locate the IRP BigQuery dataset. Set the BQ_DATASET env var to the dataset id."
  );
}

export interface BasicDetailRow {
  user_id: string | null;
  user_name: string | null;
}

export interface CourseProgressRow {
  user_id: string | null;
  course_id: string | null;
  course_title: string | null;
  mcqs_completed: number | null;
  total_mcqs: number | null;
  mcq_completion_pct: number | null;
  coding_problems_completed: number | null;
  total_coding_problems: number | null;
  coding_completion_pct: number | null;
  overall_completed: number | null;
  overall_total: number | null;
  overall_completion_pct: number | null;
}

export interface MainAssessmentDetailsRow {
  user_id: string | null;
  organisation_assessment_id: string | null;
  assessment_title: string | null;
  assessment_tag_str_extracted: string | null;
  level: string | null;
  cycle: string | null;
  assessment_start_datetime: string | Date | { value: string } | null;
  assessment_end_datetime: string | Date | { value: string } | null;
  /** BigQuery column spelling (one 's' in assesment). */
  user_assesment_start_datetime: string | Date | { value: string } | null;
  mcq_section_max_score: number | null;
  mcq_user_section_score: number | null;
  mcq_user_attempt_duration_in_mins: number | null;
  coding_section_max_score: number | null;
  coding_user_section_score: number | null;
  coding_user_attempt_duration_in_mins: number | null;
  fe_section_max_score: number | null;
  fe_user_section_score: number | null;
  fe_user_attempt_duration_in_mins: number | null;
  assessment_total_score: number | null;
  assessment_user_score: number | null;
}

export interface NxtmockDetailsRow {
  user_id: string | null;
  interview_id: string | null;
  interview_title: string | null;
  exam_type: string | null;
  level: string | null;
  cycle: string | null;
  self_intro_rating: number | null;
  javascript_coding_rating: number | null;
  javascript_rating: number | null;
  css_rating: number | null;
  html_rating: number | null;
  react_js_rating: number | null;
  average_rating: number | null;
}

const NXTMOCK_SELECT = `SELECT
      user_id, interview_id, interview_title, exam_type, level, cycle,
      self_intro_rating, javascript_coding_rating, javascript_rating,
      css_rating, html_rating, react_js_rating, average_rating`;

function nxtmockTableCandidates(): string[] {
  const configured = process.env["BQ_NXTMOCK_TABLE"]?.trim();
  const candidates = [configured, NXTMOCK_PHYSICAL_TABLE, NXTMOCK_VIEW_TABLE].filter(
    (v): v is string => Boolean(v),
  );
  return [...new Set(candidates)];
}

async function resolveNxtmockTable(bq: BigQuery, dataset: string): Promise<string> {
  const projectId = process.env["project_id"];
  let lastError: Error | null = null;

  for (const table of nxtmockTableCandidates()) {
    try {
      await bq.query({
        query: `SELECT 1 FROM \`${projectId}.${dataset}.${table}\` LIMIT 1`,
      });
      logger.info({ table, dataset }, "Resolved BigQuery nxtmock table");
      return table;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ table, err: lastError.message }, "Nxtmock table not queryable");
    }
  }

  throw new Error(
    `No queryable nxtmock table found in ${dataset}. ` +
      `Set BQ_NXTMOCK_TABLE or materialize academy_users_irp_main_nxtmock_details_for_irp_portal. ` +
      `Last error: ${lastError?.message ?? "unknown"}`
  );
}

export async function fetchBasicDetails(): Promise<BasicDetailRow[]> {
  const bq = getBigQueryClient();
  const dataset = await resolveDataset(bq);
  const projectId = process.env["project_id"];
  const query = `SELECT user_id, user_name FROM \`${projectId}.${dataset}.${BASIC_DETAILS_TABLE}\``;
  const [rows] = await bq.query({ query });
  return rows as BasicDetailRow[];
}

export async function fetchCourseProgress(): Promise<CourseProgressRow[]> {
  const bq = getBigQueryClient();
  const dataset = await resolveDataset(bq);
  const projectId = process.env["project_id"];
  const query = `SELECT
      user_id, course_id, course_title,
      mcqs_completed, total_mcqs, mcq_completion_pct,
      coding_problems_completed, total_coding_problems,
      coding_problem_completion_pct AS coding_completion_pct,
      overall_completed, overall_total, overall_completion_pct
    FROM \`${projectId}.${dataset}.${COURSE_PROGRESS_TABLE}\``;
  const [rows] = await bq.query({ query });
  return rows as CourseProgressRow[];
}

export async function fetchMainAssessmentDetails(): Promise<MainAssessmentDetailsRow[]> {
  const bq = getBigQueryClient();
  const dataset = await resolveDataset(bq);
  const projectId = process.env["project_id"];
  const table = await resolveAssessmentTable(bq, dataset);
  const query = `${ASSESSMENT_SELECT}
    FROM \`${projectId}.${dataset}.${table}\``;
  const [rows] = await bq.query({ query });
  return rows as MainAssessmentDetailsRow[];
}

export async function fetchNxtmockDetails(): Promise<NxtmockDetailsRow[]> {
  const bq = getBigQueryClient();
  const dataset = await resolveDataset(bq);
  const projectId = process.env["project_id"];
  const table = await resolveNxtmockTable(bq, dataset);
  const query = `${NXTMOCK_SELECT}
    FROM \`${projectId}.${dataset}.${table}\``;
  const [rows] = await bq.query({ query });
  return rows as NxtmockDetailsRow[];
}

/** IRP 2.0 L1 z_* attempt / summary tables (academy_student_success_pocs). */
export const Z_HUSTLER_ATTEMPT_TABLE =
  "z_academy_irp_2_0_l1_hustler_assessment_user_attempt_details";
export const Z_FE_PROJECT_ATTEMPT_TABLE =
  "z_academy_irp_2_0_l1_fe_project_user_attempt_details";
export const Z_NXTMOCK_ATTEMPT_TABLE = "z_academy_irp_2_0_l1_nxtmock_user_attempt_details";
export const Z_ROUND_WISE_SUMMARY_TABLE = "z_academy_irp_2_0_l1_user_round_wise_summary";

export interface ZHustlerAttemptRow {
  user_id: string | null;
  assessment_specific_tag: string | null;
  assessment_title: string | null;
  assessment_type: string | null;
  assessment_level: string | null;
  assessment_name: string | null;
  assessment_number: string | null;
  primary_organisation_assessment_id: string | null;
  assessment_start_datetime: string | Date | { value: string } | null;
  user_assessment_start_datetime: string | Date | { value: string } | null;
  assessment_actual_score: number | null;
  user_assessment_score: number | null;
  user_assessment_score_percentage: number | null;
  theory_section_attempt_status: string | null;
  theory_section_score: number | null;
  theory_section_score_percentage: number | null;
  coding_section_attempt_status: string | null;
  coding_section_score: number | null;
  coding_section_score_percentage: number | null;
  assessment_status: string | null;
  attempt_number: number | null;
}

export interface ZFeProjectAttemptRow {
  user_id: string | null;
  assessment_specific_tag: string | null;
  assessment_title: string | null;
  assessment_type: string | null;
  assessment_level: string | null;
  assessment_name: string | null;
  assessment_number: string | null;
  primary_organisation_assessment_id: string | null;
  assessment_start_datetime: string | Date | { value: string } | null;
  user_assessment_start_datetime: string | Date | { value: string } | null;
  assessment_actual_score: number | null;
  user_assessment_score: number | null;
  user_assessment_score_percentage: number | null;
  react_js_coding_section_attempt_status: string | null;
  react_js_coding_section_score: number | null;
  react_js_coding_section_score_percentage: number | null;
  assessment_status: string | null;
  attempt_number: number | null;
}

export interface ZNxtmockAttemptRow {
  user_id: string | null;
  interview_id: string | null;
  interview_attempt_id: string | null;
  interview_tag: string | null;
  interview_attempt_start_datetime: string | Date | { value: string } | null;
  avg_user_interview_rating: number | null;
  user_interview_overall_rating: number | null;
  interview_program: string | null;
  interview_level: string | null;
  interview_name: string | null;
  interview_number: string | null;
  interview_status: string | null;
  attempt_number: number | null;
  /** JSON: SELF_INTRO, JAVASCRIPT_CODING, JAVASCRIPT, CSS, HTML, REACT_JS */
  section_wise_rating_json: string | Record<string, unknown> | null;
}

export interface ZRoundWiseSummaryRow {
  user_id: string | null;
  hustler_assessment_status: string | null;
  hustler_assessment_score_percentage: number | null;
  hustler_assessment_number: string | null;
  hustler_assessment_attempt_number: number | null;
  hustler_assessment_attempt_date: string | Date | { value: string } | null;
  hustler_assessment_theory_section_attempt_status: string | null;
  hustler_assessment_theory_section_score: number | null;
  hustler_assessment_theory_section_score_percentage: number | null;
  hustler_assessment_coding_section_attempt_status: string | null;
  hustler_assessment_coding_section_score: number | null;
  hustler_assessment_coding_section_score_percentage: number | null;
  fe_project_status: string | null;
  fe_project_score_percentage: number | null;
  fe_project_assessment_number: string | null;
  fe_project_attempt_number: number | null;
  fe_project_attempt_date: string | Date | { value: string } | null;
  fe_project_react_js_coding_section_attempt_status: string | null;
  fe_project_react_js_coding_section_score: number | null;
  fe_project_react_js_coding_section_score_percentage: number | null;
  nxtmock_status: string | null;
  /** BQ typo: interivew */
  nxtmock_interivew_rating: number | null;
  nxtmock_interview_number: string | null;
  nxtmock_attempt_number: number | null;
  nxtmock_attempt_date: string | Date | { value: string } | null;
}

async function resolveDatasetId(bq: BigQuery): Promise<{ projectId: string; dataset: string }> {
  const projectId = process.env["project_id"];
  if (!projectId) throw new Error("project_id not configured");
  const dataset = await resolveDataset(bq);
  return { projectId, dataset };
}

/** Prefer completed sits; still include rows with attempt_number set. */
function zAttemptFilterSql(statusCol: string): string {
  return `(${statusCol} IN ('QUALIFIED', 'NOT QUALIFIED') OR attempt_number IS NOT NULL)`;
}

export async function fetchZHustlerAttempts(): Promise<ZHustlerAttemptRow[]> {
  const bq = getBigQueryClient();
  const { projectId, dataset } = await resolveDatasetId(bq);
  const fq = `${projectId}.${dataset}.${Z_HUSTLER_ATTEMPT_TABLE}`;
  const query = `SELECT
      user_id, assessment_specific_tag, assessment_title, assessment_type, assessment_level,
      assessment_name, assessment_number, primary_organisation_assessment_id,
      assessment_start_datetime, user_assessment_start_datetime,
      assessment_actual_score, user_assessment_score, user_assessment_score_percentage,
      theory_section_attempt_status, theory_section_score, theory_section_score_percentage,
      coding_section_attempt_status, coding_section_score, coding_section_score_percentage,
      assessment_status, attempt_number
    FROM \`${fq}\`
    WHERE ${zAttemptFilterSql("assessment_status")}`;
  const [rows] = await bq.query({ query });
  logger.info({ table: Z_HUSTLER_ATTEMPT_TABLE, rowCount: rows.length }, "Fetched z_* hustler attempts");
  return rows as ZHustlerAttemptRow[];
}

export async function fetchZFeProjectAttempts(): Promise<ZFeProjectAttemptRow[]> {
  const bq = getBigQueryClient();
  const { projectId, dataset } = await resolveDatasetId(bq);
  const fq = `${projectId}.${dataset}.${Z_FE_PROJECT_ATTEMPT_TABLE}`;
  const query = `SELECT
      user_id, assessment_specific_tag, assessment_title, assessment_type, assessment_level,
      assessment_name, assessment_number, primary_organisation_assessment_id,
      assessment_start_datetime, user_assessment_start_datetime,
      assessment_actual_score, user_assessment_score, user_assessment_score_percentage,
      react_js_coding_section_attempt_status, react_js_coding_section_score,
      react_js_coding_section_score_percentage, assessment_status, attempt_number
    FROM \`${fq}\`
    WHERE ${zAttemptFilterSql("assessment_status")}`;
  const [rows] = await bq.query({ query });
  logger.info({ table: Z_FE_PROJECT_ATTEMPT_TABLE, rowCount: rows.length }, "Fetched z_* FE attempts");
  return rows as ZFeProjectAttemptRow[];
}

export async function fetchZNxtmockAttempts(): Promise<ZNxtmockAttemptRow[]> {
  const bq = getBigQueryClient();
  const { projectId, dataset } = await resolveDatasetId(bq);
  const fq = `${projectId}.${dataset}.${Z_NXTMOCK_ATTEMPT_TABLE}`;
  const query = `SELECT
      user_id, interview_id, interview_attempt_id, interview_tag,
      interview_attempt_start_datetime, avg_user_interview_rating, user_interview_overall_rating,
      interview_program, interview_level, interview_name, interview_number,
      interview_status, attempt_number, section_wise_rating_json
    FROM \`${fq}\`
    WHERE ${zAttemptFilterSql("interview_status")}`;
  const [rows] = await bq.query({ query });
  logger.info({ table: Z_NXTMOCK_ATTEMPT_TABLE, rowCount: rows.length }, "Fetched z_* nxtmock attempts");
  return rows as ZNxtmockAttemptRow[];
}

export async function fetchZRoundWiseSummary(): Promise<ZRoundWiseSummaryRow[]> {
  const bq = getBigQueryClient();
  const { projectId, dataset } = await resolveDatasetId(bq);
  const fq = `${projectId}.${dataset}.${Z_ROUND_WISE_SUMMARY_TABLE}`;
  const query = `SELECT
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
    FROM \`${fq}\``;
  const [rows] = await bq.query({ query });
  logger.info({ table: Z_ROUND_WISE_SUMMARY_TABLE, rowCount: rows.length }, "Fetched z_* round-wise summary");
  return rows as ZRoundWiseSummaryRow[];
}
