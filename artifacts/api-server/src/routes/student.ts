import { Router } from "express";
import { db } from "@workspace/db";
import {
  studentsTable,
  studentMarksTable,
  studentActivityTable,
  practiceSessionsTable,
  weeklyActivityTable,
  academyUserBasicDetailsTable,
  academyUserAssessmentDetailsTable,
  academyUserCourseProgressTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveAcademyUserId } from "../lib/auth";
import { getStudentForUser, userHasAssessmentData } from "../lib/student";

const router = Router();

/** BigQuery sometimes stores encrypted tokens in user_name — not suitable for display. */
function isLikelyDisplayName(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  const v = value.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return false;
  if (v.length > 24 && /^[A-Za-z0-9+/=]+$/.test(v) && !/\s/.test(v)) return false;
  return true;
}

function studentBelongsToAcademyUser(
  studentEmail: string | null | undefined,
  academyUserId: string,
): boolean {
  if (!studentEmail?.trim()) return false;
  return studentEmail.trim().toLowerCase().startsWith(`${academyUserId.toLowerCase()}@`);
}

function resolveStudentName(
  academyUserName: string | null | undefined,
  studentName: string | null | undefined,
  academyUserId: string,
  studentEmail?: string | null,
): string {
  const envName = process.env.ACADEMY_USER_DISPLAY_NAME?.trim();
  if (envName) return envName;
  if (isLikelyDisplayName(academyUserName)) return academyUserName;
  if (studentBelongsToAcademyUser(studentEmail, academyUserId) && isLikelyDisplayName(studentName)) {
    return studentName;
  }
  return "Student";
}

async function getAcademyUserById(userId: string) {
  const [user] = await db
    .select()
    .from(academyUserBasicDetailsTable)
    .where(eq(academyUserBasicDetailsTable.userId, userId))
    .limit(1);
  return user ?? null;
}

async function getStudentProfile(userId: string) {
  if (!(await userHasAssessmentData(userId))) {
    return null;
  }

  // This user's own profile row (per academy user_id), if it exists yet.
  const s = await getStudentForUser(userId);
  const academyUser = await getAcademyUserById(userId);

  return {
    id: s?.id ?? 0,
    name: resolveStudentName(academyUser?.userName, s?.name, userId, s?.email),
    yog: s?.yog ?? 2028,
    level: s?.level ?? "Level 1 • The Hustler",
    email: s?.email ?? `${userId}@academy.local`,
    avatar: s?.avatar ?? "",
    registrationStatus: s?.registrationStatus ?? "registered",
    currentLevel: s?.currentLevel ?? 1,
  };
}

async function getSubjectProgressResponse(userId: string) {
  if (!(await userHasAssessmentData(userId))) return null;

  const academyUser = await getAcademyUserById(userId);

  const courses = await db
    .select()
    .from(academyUserCourseProgressTable)
    .where(eq(academyUserCourseProgressTable.userId, userId));

  const subjectData = courses.map((c) => ({
    subject: c.courseTitle ?? c.courseId ?? "Course",
    mcqCompleted: c.mcqsCompleted ?? 0,
    mcqTotal: c.totalMcqs ?? 0,
    codingCompleted: c.codingProblemsCompleted ?? 0,
    codingTotal: c.totalCodingProblems ?? 0,
    mcqPercentage: Math.round(c.mcqCompletionPct ?? 0),
    codingPercentage: Math.round(c.codingCompletionPct ?? 0),
  }));

  const totalMcqCompleted = subjectData.reduce((acc, s) => acc + s.mcqCompleted, 0);
  const totalMcqTotal = subjectData.reduce((acc, s) => acc + s.mcqTotal, 0);
  const totalCodingCompleted = subjectData.reduce((acc, s) => acc + s.codingCompleted, 0);
  const totalCodingTotal = subjectData.reduce((acc, s) => acc + s.codingTotal, 0);

  return {
    overallMcqPercentage:
      totalMcqTotal > 0 ? Math.round((totalMcqCompleted / totalMcqTotal) * 100) : 0,
    overallCodingPercentage:
      totalCodingTotal > 0 ? Math.round((totalCodingCompleted / totalCodingTotal) * 100) : 0,
    streakDays: 0,
    lastActiveDate:
      academyUser?.syncedAt.toISOString().slice(0, 10) ??
      courses[0]?.syncedAt?.toISOString().slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
    subjects: subjectData,
  };
}

function pct(score: number | null, max: number | null): number {
  if (score == null || max == null || max <= 0) return 0;
  return Math.round((score / max) * 100);
}

function parseAssessmentLevel(level: string | null): number | null {
  if (!level?.trim()) return null;
  const match = /^L?(\d)/i.exec(level.trim());
  return match ? Number(match[1]) : null;
}

async function getAssessmentResultsResponse(userId: string) {
  if (!(await userHasAssessmentData(userId))) return null;

  const rows = await db
    .select()
    .from(academyUserAssessmentDetailsTable)
    .where(eq(academyUserAssessmentDetailsTable.userId, userId));

  return {
    assessments: rows.map((a) => {
      const mcqScore = a.mcqUserSectionScore ?? 0;
      const mcqMax = a.mcqSectionMaxScore ?? 0;
      const codingScore = a.codingUserSectionScore ?? 0;
      const codingMax = a.codingSectionMaxScore ?? 0;
      const overallScore = a.assessmentUserScore ?? mcqScore + codingScore;
      const overallMax = a.assessmentTotalScore ?? mcqMax + codingMax;

      return {
        organisationAssessmentId: a.organisationAssessmentId,
        assessmentTitle: a.assessmentTitle ?? "Assessment",
        assessmentTag: a.assessmentTag ?? undefined,
        level: a.level ?? "",
        cycle: a.cycle ?? undefined,
        mcqScore,
        mcqMax,
        mcqPct: pct(a.mcqUserSectionScore, a.mcqSectionMaxScore),
        codingScore,
        codingMax,
        codingPct: pct(a.codingUserSectionScore, a.codingSectionMaxScore),
        overallScore,
        overallMax,
        overallPct: pct(
          a.assessmentUserScore ?? (mcqScore + codingScore || null),
          a.assessmentTotalScore ?? (mcqMax + codingMax || null),
        ),
        levelNumber: parseAssessmentLevel(a.level),
      };
    }),
  };
}

router.get("/student", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const profile = await getStudentProfile(userId);
    if (!profile) {
      res.status(404).json({
        error: "Not found in IRP assessment data",
        code: "NOT_ENROLLED",
        userId,
      });
      return;
    }
    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to get student");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/student/progress", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const progress = await getSubjectProgressResponse(userId);
    if (!progress) {
      res.status(404).json({
        error: "Not found in IRP assessment data",
        code: "NOT_ENROLLED",
        userId,
      });
      return;
    }
    res.json(progress);
  } catch (err) {
    req.log.error({ err }, "Failed to get student progress");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/student/assessments", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const results = await getAssessmentResultsResponse(userId);
    if (!results) {
      res.status(404).json({
        error: "Not found in IRP assessment data",
        code: "NOT_ENROLLED",
        userId,
      });
      return;
    }
    res.json({
      assessments: results.assessments.map(
        ({ levelNumber: _levelNumber, ...assessment }) => assessment,
      ),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get student assessments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/student/marks", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const student = await getStudentForUser(userId);
    if (!student) {
      res.json([]);
      return;
    }
    const marks = await db
      .select()
      .from(studentMarksTable)
      .where(eq(studentMarksTable.studentId, student.id))
      .orderBy(studentMarksTable.date);

    res.json(
      marks.map((m) => ({
        id: m.id,
        subject: m.subject,
        category: m.category,
        score: m.score,
        maxScore: m.maxScore,
        percentage: m.percentage,
        assessmentType: m.assessmentType,
        date: m.date,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get student marks");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/student/activity", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const student = await getStudentForUser(userId);
    if (!student) {
      res.json({ totalMcqSolved: 0, totalCodingSolved: 0, weeklyActivity: [], recentSessions: [] });
      return;
    }
    const activity = await db
      .select()
      .from(studentActivityTable)
      .where(eq(studentActivityTable.studentId, student.id))
      .limit(1);

    const weeklyActivity = await db
      .select()
      .from(weeklyActivityTable)
      .where(eq(weeklyActivityTable.studentId, student.id));

    const recentSessions = await db
      .select()
      .from(practiceSessionsTable)
      .where(eq(practiceSessionsTable.studentId, student.id))
      .orderBy(practiceSessionsTable.createdAt)
      .limit(10);

    const activityData = activity[0];

    res.json({
      totalMcqSolved: activityData?.totalMcqSolved ?? 0,
      totalCodingSolved: activityData?.totalCodingSolved ?? 0,
      weeklyActivity: weeklyActivity.map((w) => ({
        day: w.day,
        mcq: w.mcq,
        coding: w.coding,
      })),
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        subject: s.subject,
        type: s.type,
        duration: s.duration,
        date: s.date,
        questionsAttempted: s.questionsAttempted,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get student activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
