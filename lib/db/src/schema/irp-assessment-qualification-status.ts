import { pgTable, text, unique } from "drizzle-orm/pg-core";

/**
 * Latest rule-based qualification status for each student and named assessment.
 * Keep this compact table separate from the BigQuery-owned assessment mirror.
 */
export const irpAssessmentQualificationStatusesTable = pgTable(
  "irp_assessment_qualification_statuses",
  {
    userId: text("user_id").notNull(),
    assessmentSpecificTag: text("assessment_specific_tag").notNull(),
    assessmentTitle: text("assessment_title").notNull(),
    qualificationStatus: text("qualification_status").notNull(),
  },
  (table) => ({
    studentAssessmentUnique: unique("irp_assessment_qualification_statuses_unique").on(
      table.userId,
      table.assessmentSpecificTag,
      table.assessmentTitle,
    ),
  }),
);
