import { pgTable, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Read-only Academy Nexus mirror; interviewId preserves every student's attempts. */
export const humanInterviewResultsTable = pgTable("human_interview_results", {
  interviewId: text("interview_id").primaryKey(),
  candidateId: text("candidate_id").notNull(),
  interviewDate: text("interview_date").notNull(),
  interviewStartTime: text("interview_start_time").notNull(),
  interviewStartsAt: timestamp("interview_starts_at", { withTimezone: true }),
  part1Avg: real("part1_avg"),
  part2Avg: real("part2_avg"),
  part3Avg: real("part3_avg"),
  communicationRating: real("communication_rating"),
  finalScore: real("final_score"),
  clearanceStatus: text("clearance_status").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("human_interview_results_candidate_idx").on(t.candidateId)]);

export const insertHumanInterviewResultSchema = createInsertSchema(humanInterviewResultsTable).omit({ syncedAt: true });
export type InsertHumanInterviewResult = z.infer<typeof insertHumanInterviewResultSchema>;
export type HumanInterviewResult = typeof humanInterviewResultsTable.$inferSelect;
