import { pgTable, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

/** App-owned GenAI output, separate from the warehouse-owned attempt mirror. */
export const irpGenaiAssessmentQualificationStatusesTable = pgTable(
  "irp_genai_assessment_qualification_statuses",
  {
    userId: text("user_id").notNull(),
    assessmentSpecificTag: text("assessment_specific_tag"),
    assessmentTitle: text("assessment_title"),
    qualificationStatus: text("qualification_status").notNull(),
  },
  (table) => [
    unique("irp_genai_assessment_qualification_statuses_unique")
      .on(table.userId, table.assessmentSpecificTag, table.assessmentTitle)
      .nullsNotDistinct(),
  ],
);

export const insertIrpGenaiAssessmentQualificationStatusSchema =
  createInsertSchema(irpGenaiAssessmentQualificationStatusesTable);
export type IrpGenaiAssessmentQualificationStatus =
  typeof irpGenaiAssessmentQualificationStatusesTable.$inferSelect;
