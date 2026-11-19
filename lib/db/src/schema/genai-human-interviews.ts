import { pgTable, text, real, timestamp, index } from "drizzle-orm/pg-core";

/** Read-only Academy Nexus mirror of the irp-gen-ai template; interviewId preserves every attempt. */
export const genaiHumanInterviewResultsTable = pgTable("genai_human_interview_results", {
  interviewId: text("interview_id").primaryKey(),
  candidateId: text("candidate_id").notNull(),
  interviewDate: text("interview_date").notNull(),
  interviewStartTime: text("interview_start_time").notNull(),
  interviewStartsAt: timestamp("interview_starts_at", { withTimezone: true }),
  projectRating: real("project_rating"),
  projectRemarks: text("project_remarks"),
  conceptRating: real("concept_rating"),
  conceptRemarks: text("concept_remarks"),
  dsaRating: real("dsa_rating"),
  dsaRemarks: text("dsa_remarks"),
  communicationRating: real("communication_rating"),
  communicationRemarks: text("communication_remarks"),
  finalScore: real("final_score"),
  verdictBand: text("verdict_band").notNull().default(""),
  clearanceStatus: text("clearance_status").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("genai_human_interview_results_candidate_idx").on(t.candidateId)]);

export type GenaiHumanInterviewResult = typeof genaiHumanInterviewResultsTable.$inferSelect;
