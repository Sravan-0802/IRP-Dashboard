import { pgTable, text, serial, integer, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  yog: integer("yog").notNull(),
  level: text("level").notNull().default("Level 1"),
  email: text("email").notNull().unique(),
  avatar: text("avatar").notNull().default(""),
  registrationStatus: text("registration_status").notNull().default("registered"),
  currentLevel: integer("current_level").notNull().default(1),
  // ── IRP 2.0 journey state machine ──
  journeyState: text("journey_state").notNull().default("L1_PREP"),
  isWildcard: integer("is_wildcard").notNull().default(0),
  hasCompletedOnboarding: integer("has_completed_onboarding").notNull().default(0),
  // True once the student has attempted an L1 exam — blocks Standard -> Wildcard.
  hasAttemptedL1: integer("has_attempted_l1").notNull().default(0),
  // True once an L3 exam has started — blocks Wildcard -> Standard.
  l3ExamStarted: integer("l3_exam_started").notNull().default(0),
  reattemptDate: text("reattempt_date"),
  projectSubmitted: integer("project_submitted").notNull().default(0),
  projectDueDate: text("project_due_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subjectProgressTable = pgTable("subject_progress", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  subject: text("subject").notNull(),
  mcqCompleted: integer("mcq_completed").notNull().default(0),
  mcqTotal: integer("mcq_total").notNull().default(0),
  codingCompleted: integer("coding_completed").notNull().default(0),
  codingTotal: integer("coding_total").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentMarksTable = pgTable("student_marks", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  subject: text("subject").notNull(),
  category: text("category").notNull(), // MCQ or Coding
  score: real("score").notNull(),
  maxScore: real("max_score").notNull(),
  percentage: real("percentage").notNull(),
  assessmentType: text("assessment_type").notNull(), // Practice or Mock Assessment
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentActivityTable = pgTable("student_activity", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  streakDays: integer("streak_days").notNull().default(0),
  lastActiveDate: text("last_active_date").notNull().default(""),
  totalMcqSolved: integer("total_mcq_solved").notNull().default(0),
  totalCodingSolved: integer("total_coding_solved").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const practiceSessionsTable = pgTable("practice_sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  subject: text("subject").notNull(),
  type: text("type").notNull(), // MCQ or Coding
  duration: integer("duration").notNull(), // minutes
  date: text("date").notNull(),
  questionsAttempted: integer("questions_attempted").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weeklyActivityTable = pgTable("weekly_activity", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  day: text("day").notNull(),
  mcq: integer("mcq").notNull().default(0),
  coding: integer("coding").notNull().default(0),
});

export const formsAuthTokensTable = pgTable("forms_auth_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: integer("used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assessmentSlotsTable = pgTable("assessment_slots", {
  id: serial("id").primaryKey(),
  level: integer("level").notNull().default(1),
  round: integer("round").notNull().default(1),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  capacity: integer("capacity").notNull().default(0),
  released: integer("released").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const slotBookingsTable = pgTable(
  "slot_bookings",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull().references(() => studentsTable.id),
    slotId: integer("slot_id").notNull().references(() => assessmentSlotsTable.id),
    round: integer("round").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    oneBookingPerRound: unique("slot_booking_student_round_unique").on(t.studentId, t.round),
  })
);

export const slotNotifyRequestsTable = pgTable("slot_notify_requests", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  whatsappNumber: text("whatsapp_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** L1 assessment slot registration per cycle (Cycle 2 = July 2026, etc.). */
export const l1CycleRegistrationsTable = pgTable(
  "l1_cycle_registrations",
  {
    id: serial("id").primaryKey(),
    academyUserId: text("academy_user_id").notNull(),
    studentId: integer("student_id").references(() => studentsTable.id),
    userName: text("user_name"),
    cycle: integer("cycle").notNull(),
    level: integer("level").notNull().default(1),
    assessmentDate: text("assessment_date").notNull(),
    availability: text("availability").notNull(),
    slotId: text("slot_id"),
    slotLabel: text("slot_label"),
    understandsGc: integer("understands_gc"),
    willAttend: integer("will_attend"),
    unavailabilityReason: text("unavailability_reason"),
    notifyNextCycle: integer("notify_next_cycle"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCycleLevelUnique: unique("l1_cycle_reg_user_cycle_level").on(
      t.academyUserId,
      t.cycle,
      t.level,
    ),
  }),
);

/**
 * Authoritative exam-platform (topin.tech) access list per cycle.
 * Source of truth for which slot's MAIN assessment link a student sees.
 * Populated from the uploaded exam-platform export, mapped by academyUserId.
 */
export const l1ExamAccessTable = pgTable(
  "l1_exam_access",
  {
    id: serial("id").primaryKey(),
    academyUserId: text("academy_user_id").notNull(),
    cycle: integer("cycle").notNull().default(2),
    slotId: text("slot_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCycleUnique: unique("l1_exam_access_user_cycle").on(t.academyUserId, t.cycle),
  }),
);

/**
 * Users who have not completed their course payment. While a user is on this
 * list, the dashboard is gated behind a "complete your payment" prompt.
 * Populated from the uploaded unpaid-users export, keyed by academyUserId.
 */
export const unpaidUsersTable = pgTable("unpaid_users", {
  academyUserId: text("academy_user_id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contactUsMessagesTable = pgTable("contact_us_messages", {
  id: serial("id").primaryKey(),
  academyUserId: text("academy_user_id").notNull(),
  studentId: integer("student_id").references(() => studentsTable.id),
  userName: text("user_name"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dashboardFeedbackTable = pgTable("dashboard_feedback", {
  id: serial("id").primaryKey(),
  academyUserId: text("academy_user_id").notNull(),
  studentId: integer("student_id").references(() => studentsTable.id),
  rating: integer("rating").notNull(),
  ratingLabel: text("rating_label").notNull(),
  responses: text("responses").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dashboardAnalyticsEventsTable = pgTable("dashboard_analytics_events", {
  id: serial("id").primaryKey(),
  academyUserId: text("academy_user_id").notNull(),
  studentId: integer("student_id").references(() => studentsTable.id),
  eventType: text("event_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Mirror of BigQuery `academy_users_basic_details_for_irp_portal`
export const academyUserBasicDetailsTable = pgTable("academy_user_basic_details", {
  userId: text("user_id").primaryKey(),
  userName: text("user_name"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

// Mirror of BigQuery `y_academy_users_irp_main_assessment_details_for_irp_portal`
export const academyUserAssessmentDetailsTable = pgTable(
  "academy_user_assessment_details",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    organisationAssessmentId: text("organisation_assessment_id").notNull(),
    assessmentTitle: text("assessment_title"),
    assessmentTag: text("assessment_tag"),
    level: text("level"),
    cycle: text("cycle"),
    mcqSectionMaxScore: real("mcq_section_max_score"),
    mcqUserSectionScore: real("mcq_user_section_score"),
    mcqAttemptDurationMins: real("mcq_attempt_duration_mins"),
    codingSectionMaxScore: real("coding_section_max_score"),
    codingUserSectionScore: real("coding_user_section_score"),
    codingAttemptDurationMins: real("coding_attempt_duration_mins"),
    assessmentTotalScore: real("assessment_total_score"),
    assessmentUserScore: real("assessment_user_score"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userAssessmentUnique: unique("academy_user_assessment_unique").on(
      t.userId,
      t.organisationAssessmentId,
    ),
  }),
);

// Mirror of BigQuery `academy_users_course_progress_data_for_irp_portal`
export const academyUserCourseProgressTable = pgTable(
  "academy_user_course_progress",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    courseId: text("course_id").notNull(),
    courseTitle: text("course_title"),
    mcqsCompleted: integer("mcqs_completed"),
    totalMcqs: integer("total_mcqs"),
    mcqCompletionPct: real("mcq_completion_pct"),
    codingProblemsCompleted: integer("coding_problems_completed"),
    totalCodingProblems: integer("total_coding_problems"),
    codingCompletionPct: real("coding_completion_pct"),
    overallCompleted: integer("overall_completed"),
    overallTotal: integer("overall_total"),
    overallCompletionPct: real("overall_completion_pct"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCourseUnique: unique("academy_user_course_unique").on(t.userId, t.courseId),
  })
);

// Tracks the status of each BigQuery -> Postgres sync run
export const bigquerySyncStatusTable = pgTable("bigquery_sync_status", {
  id: serial("id").primaryKey(),
  tableName: text("table_name").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | success | error
  rowCount: integer("row_count").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  error: text("error"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AcademyUserBasicDetails = typeof academyUserBasicDetailsTable.$inferSelect;
export type AcademyUserAssessmentDetails = typeof academyUserAssessmentDetailsTable.$inferSelect;
export type AcademyUserCourseProgress = typeof academyUserCourseProgressTable.$inferSelect;
export type BigquerySyncStatus = typeof bigquerySyncStatusTable.$inferSelect;

export type L1CycleRegistration = typeof l1CycleRegistrationsTable.$inferSelect;
export type InsertL1CycleRegistration = typeof l1CycleRegistrationsTable.$inferInsert;

export type L1ExamAccess = typeof l1ExamAccessTable.$inferSelect;
export type InsertL1ExamAccess = typeof l1ExamAccessTable.$inferInsert;

export type UnpaidUser = typeof unpaidUsersTable.$inferSelect;
export type InsertUnpaidUser = typeof unpaidUsersTable.$inferInsert;

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;

export const insertSubjectProgressSchema = createInsertSchema(subjectProgressTable).omit({ id: true, updatedAt: true });
export type InsertSubjectProgress = z.infer<typeof insertSubjectProgressSchema>;
export type SubjectProgress = typeof subjectProgressTable.$inferSelect;

export const insertStudentMarksSchema = createInsertSchema(studentMarksTable).omit({ id: true, createdAt: true });
export type InsertStudentMark = z.infer<typeof insertStudentMarksSchema>;
export type StudentMark = typeof studentMarksTable.$inferSelect;
