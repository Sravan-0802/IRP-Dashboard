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
    if (ids.includes(BASIC_DETAILS_TABLE) || ids.includes(COURSE_PROGRESS_TABLE)) {
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
