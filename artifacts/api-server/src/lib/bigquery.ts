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
      mcq_section_max_score, mcq_user_section_score, mcq_user_attempt_duration_in_mins,
      coding_section_max_score, coding_user_section_score, coding_user_attempt_duration_in_mins,
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
      ids.includes(NXTMOCK_VIEW_TABLE)
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
  mcq_section_max_score: number | null;
  mcq_user_section_score: number | null;
  mcq_user_attempt_duration_in_mins: number | null;
  coding_section_max_score: number | null;
  coding_user_section_score: number | null;
  coding_user_attempt_duration_in_mins: number | null;
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
