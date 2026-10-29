import { createInsertSchema } from "drizzle-zod";
import { pgTable, real, serial, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/**
 * App-owned calculated L1 results. Keep separate from academy_user_assessment_details,
 * which is a BigQuery mirror and can be overwritten by the next sync.
 */
export const irpL1AssessmentStatusesTable = pgTable(
  "irp_l1_assessment_statuses",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    organisationAssessmentId: text("organisation_assessment_id").notNull(),
    assessmentTag: text("assessment_tag"),
    assessmentTitle: text("assessment_title"),
    cycle: text("cycle"),
    assessmentNumber: integer("assessment_number"),
    attemptNumber: integer("attempt_number"),
    score: real("score"),
    maxScore: real("max_score"),
    scorePercentage: real("score_percentage"),
    assessmentStatus: text("assessment_status").notNull(),
    statusSource: text("status_source").notNull(),
    rawAssessmentStatus: text("raw_assessment_status"),
    requiredPercentage: real("required_percentage"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userAssessmentUnique: unique("irp_l1_assessment_statuses_user_assessment_unique").on(
      table.userId,
      table.organisationAssessmentId,
    ),
  }),
);

export const insertIrpL1AssessmentStatusSchema = createInsertSchema(irpL1AssessmentStatusesTable).omit({
  id: true,
  calculatedAt: true,
  updatedAt: true,
});
export type InsertIrpL1AssessmentStatus = z.infer<typeof insertIrpL1AssessmentStatusSchema>;
export type IrpL1AssessmentStatus = typeof irpL1AssessmentStatusesTable.$inferSelect;
