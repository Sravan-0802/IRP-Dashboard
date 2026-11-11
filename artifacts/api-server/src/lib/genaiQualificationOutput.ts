import {
  db,
  irpGenaiAssessmentQualificationStatusesTable,
  type AcademyUserGenaiAssessmentDetails,
} from "@workspace/db";
import { getBigQueryClient } from "./bigquery";
import { logger } from "./logger";

export const GENAI_QUALIFICATION_OUTPUT_TABLE =
  "kossip-helpers.academy_student_success_pocs_data_output.academy_irp_2_0_genai_assessment_qualification_status_output";

type OutputRow = typeof irpGenaiAssessmentQualificationStatusesTable.$inferInsert;
type SourceRow = AcademyUserGenaiAssessmentDetails;

/** Preserve source tags/titles; repeated attempts use the latest started attempt, not the best score. */
export function buildGenaiQualificationOutput(rows: SourceRow[]): OutputRow[] {
  const latest = new Map<string, SourceRow>();
  const rank = (row: SourceRow) => [
    row.userAssessmentStartDatetime?.getTime() ?? -1,
    row.attemptNumber ?? -1,
    row.assessmentStartDatetime?.getTime() ?? -1,
    row.syncedAt.getTime(),
    row.id,
  ];
  for (const row of rows) {
    if (!row.userId || !row.qualificationStatus) {
      throw new Error("GenAI qualification output requires a student and a computed status");
    }
    const key = JSON.stringify([row.userId, row.assessmentTag, row.assessmentTitle]);
    const previous = latest.get(key);
    const currentRank = rank(row);
    const previousRank = previous ? rank(previous) : [];
    const difference = currentRank
      .map((value, index) => value - (previousRank[index] ?? -1))
      .find(value => value !== 0) ?? 0;
    if (!previous || difference > 0) latest.set(key, row);
  }
  return [...latest.values()].map(row => ({
    userId: row.userId,
    assessmentSpecificTag: row.assessmentTag,
    assessmentTitle: row.assessmentTitle,
    qualificationStatus: row.qualificationStatus!,
  }));
}

export function genaiOutputWarehouseRows(rows: OutputRow[]) {
  return rows.map(row => ({
    user_id: row.userId,
    assessment_specific_tag: row.assessmentSpecificTag ?? null,
    assessment_title: row.assessmentTitle ?? null,
    qualification_status: row.qualificationStatus,
  }));
}

/**
 * Idempotent, non-destructive write-back. Never changes source attempt tables or
 * deletes warehouse rows. Errors propagate so syncs do not report false success.
 */
export async function publishGenaiQualificationOutput(): Promise<number> {
  const rows = await db.select().from(irpGenaiAssessmentQualificationStatusesTable);
  if (rows.length === 0) return 0;
  const bq = getBigQueryClient();
  const dataset = bq.dataset("academy_student_success_pocs_data_output", { projectId: "kossip-helpers" });
  const [metadata] = await dataset.table("academy_irp_2_0_genai_assessment_qualification_status_output").getMetadata();
  const columns = ["user_id", "assessment_specific_tag", "assessment_title", "qualification_status"];
  for (const name of columns) {
    const field = metadata.schema?.fields?.find((field: { name?: string }) => field.name === name);
    if (!field || field.type !== "STRING" || field.mode === "REPEATED") {
      throw new Error(`BigQuery GenAI output requires a scalar STRING column: ${name}`);
    }
  }
  const [datasetMetadata] = await dataset.getMetadata();
  for (let index = 0; index < rows.length; index += 500) {
    const batch = genaiOutputWarehouseRows(rows.slice(index, index + 500));
    await bq.query({
      location: datasetMetadata.location,
      params: { rows: JSON.stringify(batch) },
      query: `
        MERGE \`${GENAI_QUALIFICATION_OUTPUT_TABLE}\` AS target
        USING (
          SELECT JSON_VALUE(item, '$.user_id') AS user_id,
                 JSON_VALUE(item, '$.assessment_specific_tag') AS assessment_specific_tag,
                 JSON_VALUE(item, '$.assessment_title') AS assessment_title,
                 JSON_VALUE(item, '$.qualification_status') AS qualification_status
          FROM UNNEST(JSON_QUERY_ARRAY(PARSE_JSON(@rows))) AS item
        ) AS source
        ON target.user_id = source.user_id
          AND target.assessment_specific_tag IS NOT DISTINCT FROM source.assessment_specific_tag
          AND target.assessment_title IS NOT DISTINCT FROM source.assessment_title
        WHEN MATCHED AND target.qualification_status IS DISTINCT FROM source.qualification_status THEN
          UPDATE SET qualification_status = source.qualification_status
        WHEN NOT MATCHED THEN
          INSERT (user_id, assessment_specific_tag, assessment_title, qualification_status)
          VALUES (source.user_id, source.assessment_specific_tag, source.assessment_title, source.qualification_status)
      `,
    });
  }
  logger.info({ rowCount: rows.length, table: GENAI_QUALIFICATION_OUTPUT_TABLE }, "GenAI qualification output written to BigQuery");
  return rows.length;
}
