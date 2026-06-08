import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
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

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;

export const insertSubjectProgressSchema = createInsertSchema(subjectProgressTable).omit({ id: true, updatedAt: true });
export type InsertSubjectProgress = z.infer<typeof insertSubjectProgressSchema>;
export type SubjectProgress = typeof subjectProgressTable.$inferSelect;

export const insertStudentMarksSchema = createInsertSchema(studentMarksTable).omit({ id: true, createdAt: true });
export type InsertStudentMark = z.infer<typeof insertStudentMarksSchema>;
export type StudentMark = typeof studentMarksTable.$inferSelect;
