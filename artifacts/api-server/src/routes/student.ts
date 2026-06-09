import { Router } from "express";
import { db } from "@workspace/db";
import {
  studentsTable,
  subjectProgressTable,
  studentMarksTable,
  studentActivityTable,
  practiceSessionsTable,
  weeklyActivityTable,
  academyUserBasicDetailsTable,
  academyUserCourseProgressTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const STUDENT_ID = 1;

async function getPrimaryAcademyUser() {
  const users = await db.select().from(academyUserBasicDetailsTable);
  if (users.length === 0) return null;
  return users.find((u) => u.userName?.toLowerCase().includes("sravan")) ?? users[0];
}

async function getStudentProfile() {
  const [studentRow] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, STUDENT_ID))
    .limit(1);

  const academyUser = await getPrimaryAcademyUser();

  if (academyUser) {
    const s = studentRow;
    return {
      id: STUDENT_ID,
      name: academyUser.userName ?? s?.name ?? "Student",
      yog: s?.yog ?? 2028,
      level: s?.level ?? "Level 1 • The Hustler",
      email: s?.email ?? `${academyUser.userId}@academy.local`,
      avatar: s?.avatar ?? "",
      registrationStatus: s?.registrationStatus ?? "registered",
      currentLevel: s?.currentLevel ?? 1,
    };
  }

  if (!studentRow) return null;

  return {
    id: studentRow.id,
    name: studentRow.name,
    yog: studentRow.yog,
    level: studentRow.level,
    email: studentRow.email,
    avatar: studentRow.avatar,
    registrationStatus: studentRow.registrationStatus,
    currentLevel: studentRow.currentLevel,
  };
}

async function getSubjectProgressResponse() {
  const academyUser = await getPrimaryAcademyUser();
  if (academyUser) {
    const courses = await db
      .select()
      .from(academyUserCourseProgressTable)
      .where(eq(academyUserCourseProgressTable.userId, academyUser.userId));

    if (courses.length > 0) {
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
          totalCodingTotal > 0
            ? Math.round((totalCodingCompleted / totalCodingTotal) * 100)
            : 0,
        streakDays: 0,
        lastActiveDate: academyUser.syncedAt.toISOString().slice(0, 10),
        subjects: subjectData,
      };
    }
  }

  const subjects = await db
    .select()
    .from(subjectProgressTable)
    .where(eq(subjectProgressTable.studentId, STUDENT_ID));

  const activity = await db
    .select()
    .from(studentActivityTable)
    .where(eq(studentActivityTable.studentId, STUDENT_ID))
    .limit(1);

  const activityData = activity[0];

  const subjectData = subjects.map((s) => ({
    subject: s.subject,
    mcqCompleted: s.mcqCompleted,
    mcqTotal: s.mcqTotal,
    codingCompleted: s.codingCompleted,
    codingTotal: s.codingTotal,
    mcqPercentage: s.mcqTotal > 0 ? Math.round((s.mcqCompleted / s.mcqTotal) * 100) : 0,
    codingPercentage:
      s.codingTotal > 0 ? Math.round((s.codingCompleted / s.codingTotal) * 100) : 0,
  }));

  const totalMcqCompleted = subjects.reduce((acc, s) => acc + s.mcqCompleted, 0);
  const totalMcqTotal = subjects.reduce((acc, s) => acc + s.mcqTotal, 0);
  const totalCodingCompleted = subjects.reduce((acc, s) => acc + s.codingCompleted, 0);
  const totalCodingTotal = subjects.reduce((acc, s) => acc + s.codingTotal, 0);

  return {
    overallMcqPercentage:
      totalMcqTotal > 0 ? Math.round((totalMcqCompleted / totalMcqTotal) * 100) : 0,
    overallCodingPercentage:
      totalCodingTotal > 0
        ? Math.round((totalCodingCompleted / totalCodingTotal) * 100)
        : 0,
    streakDays: activityData?.streakDays ?? 0,
    lastActiveDate: activityData?.lastActiveDate ?? "",
    subjects: subjectData,
  };
}

router.get("/student", async (req, res) => {
  try {
    const profile = await getStudentProfile();
    if (!profile) {
      res.status(404).json({ error: "Student not found" });
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
    res.json(await getSubjectProgressResponse());
  } catch (err) {
    req.log.error({ err }, "Failed to get student progress");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/student/marks", async (req, res) => {
  try {
    const marks = await db
      .select()
      .from(studentMarksTable)
      .where(eq(studentMarksTable.studentId, STUDENT_ID))
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
    const activity = await db
      .select()
      .from(studentActivityTable)
      .where(eq(studentActivityTable.studentId, STUDENT_ID))
      .limit(1);

    const weeklyActivity = await db
      .select()
      .from(weeklyActivityTable)
      .where(eq(weeklyActivityTable.studentId, STUDENT_ID));

    const recentSessions = await db
      .select()
      .from(practiceSessionsTable)
      .where(eq(practiceSessionsTable.studentId, STUDENT_ID))
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
