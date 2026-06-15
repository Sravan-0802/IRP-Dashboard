import { Router } from "express";
import {
  db,
  academyUserBasicDetailsTable,
  academyUserAssessmentDetailsTable,
  academyUserCourseProgressTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/academy/users — list synced users (basic details)
router.get("/academy/users", async (req, res) => {
  try {
    const users = await db.select().from(academyUserBasicDetailsTable);
    res.json(
      users.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        syncedAt: u.syncedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list academy users");
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/academy/users/:userId/progress — course progress for one user
router.get("/academy/users/:userId/progress", async (req, res) => {
  try {
    const { userId } = req.params;

    const basic = await db
      .select()
      .from(academyUserBasicDetailsTable)
      .where(eq(academyUserBasicDetailsTable.userId, userId))
      .limit(1);

    const courses = await db
      .select()
      .from(academyUserCourseProgressTable)
      .where(eq(academyUserCourseProgressTable.userId, userId));

    res.json({
      userId,
      userName: basic[0]?.userName ?? null,
      courses: courses.map((c) => ({
        courseId: c.courseId,
        courseTitle: c.courseTitle,
        mcqsCompleted: c.mcqsCompleted,
        totalMcqs: c.totalMcqs,
        mcqCompletionPct: c.mcqCompletionPct,
        codingProblemsCompleted: c.codingProblemsCompleted,
        totalCodingProblems: c.totalCodingProblems,
        codingCompletionPct: c.codingCompletionPct,
        overallCompleted: c.overallCompleted,
        overallTotal: c.overallTotal,
        overallCompletionPct: c.overallCompletionPct,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user progress");
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/academy/users/:userId/assessments — main assessment results for one user
router.get("/academy/users/:userId/assessments", async (req, res) => {
  try {
    const { userId } = req.params;

    const basic = await db
      .select()
      .from(academyUserBasicDetailsTable)
      .where(eq(academyUserBasicDetailsTable.userId, userId))
      .limit(1);

    const assessments = await db
      .select()
      .from(academyUserAssessmentDetailsTable)
      .where(eq(academyUserAssessmentDetailsTable.userId, userId));

    res.json({
      userId,
      userName: basic[0]?.userName ?? null,
      assessments: assessments.map((a) => ({
        organisationAssessmentId: a.organisationAssessmentId,
        assessmentTitle: a.assessmentTitle,
        assessmentTag: a.assessmentTag,
        level: a.level,
        cycle: a.cycle,
        mcqSectionMaxScore: a.mcqSectionMaxScore,
        mcqUserSectionScore: a.mcqUserSectionScore,
        mcqAttemptDurationMins: a.mcqAttemptDurationMins,
        codingSectionMaxScore: a.codingSectionMaxScore,
        codingUserSectionScore: a.codingUserSectionScore,
        codingAttemptDurationMins: a.codingAttemptDurationMins,
        assessmentTotalScore: a.assessmentTotalScore,
        assessmentUserScore: a.assessmentUserScore,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user assessments");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
