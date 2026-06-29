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
  contactUsMessagesTable,
  dashboardFeedbackTable,
  dashboardAnalyticsEventsTable,
  l1CycleRegistrationsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { resolveAcademyUserId } from "../lib/auth";
import { getOrCreateStudentForUser, getStudentForUser, userHasAssessmentData } from "../lib/student";
import {
  L1_REGISTRATION_ASSESSMENT_DATE,
  L1_REGISTRATION_CYCLE,
  L1_REGISTRATION_LEVEL,
  rowToL1RegistrationResponse,
  slotLabelFor,
  validateL1RegistrationPayload,
} from "../lib/l1Registration";

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
  // Always resolve the name per-user from the synced academy data first.
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
  const v = level.trim();
  const levelWord = /level\s*(\d+)/i.exec(v);
  if (levelWord) {
    const n = Number(levelWord[1]);
    return n >= 1 && n <= 3 ? n : null;
  }
  const lPrefix = /^L(\d+)/i.exec(v);
  if (lPrefix) {
    const n = Number(lPrefix[1]);
    return n >= 1 && n <= 3 ? n : null;
  }
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return n >= 1 && n <= 3 ? n : null;
  }
  return null;
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
      const hasWrittenAssessment =
        a.assessmentUserScore != null ||
        a.mcqUserSectionScore != null ||
        a.codingUserSectionScore != null;

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
        hasWrittenAssessment,
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

router.post("/student/contact", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!raw || raw.length > 2000) {
      res.status(400).json({ error: "Message must be 1–2000 characters" });
      return;
    }

    const student = await getStudentForUser(userId);
    const [basic] = await db
      .select({ userName: academyUserBasicDetailsTable.userName })
      .from(academyUserBasicDetailsTable)
      .where(eq(academyUserBasicDetailsTable.userId, userId))
      .limit(1);

    const displayName = isLikelyDisplayName(student?.name)
      ? student!.name
      : isLikelyDisplayName(basic?.userName)
        ? basic!.userName!
        : null;

    const [row] = await db
      .insert(contactUsMessagesTable)
      .values({
        academyUserId: userId,
        studentId: student?.id ?? null,
        userName: displayName,
        message: raw,
      })
      .returning({ id: contactUsMessagesTable.id });

    res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    req.log.error({ err }, "Failed to save contact message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/student/feedback", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Rating must be an integer from 1 to 5" });
      return;
    }

    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const normalized = answers
      .map((entry: unknown) => {
        if (!entry || typeof entry !== "object") return null;
        const question = "question" in entry && typeof entry.question === "string" ? entry.question.trim() : "";
        const answer = "answer" in entry && typeof entry.answer === "string" ? entry.answer.trim() : "";
        if (!question || !answer || answer.length > 1000) return null;
        return { question, answer };
      })
      .filter(Boolean) as { question: string; answer: string }[];

    if (!label || normalized.length === 0) {
      res.status(400).json({ error: "At least one answer is required" });
      return;
    }

    const student = await getStudentForUser(userId);

    const [row] = await db
      .insert(dashboardFeedbackTable)
      .values({
        academyUserId: userId,
        studentId: student?.id ?? null,
        rating,
        ratingLabel: label,
        responses: JSON.stringify(normalized),
      })
      .returning({ id: dashboardFeedbackTable.id });

    res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    req.log.error({ err }, "Failed to save dashboard feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

const ANALYTICS_EVENT_TYPES = new Set([
  "dashboard_visit",
  "nav_dashboard",
  "nav_assessment_calendar",
  "feedback_open",
  "contact_us_click",
]);

router.post("/student/analytics/event", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const eventType =
      typeof req.body?.eventType === "string" ? req.body.eventType.trim() : "";
    if (!ANALYTICS_EVENT_TYPES.has(eventType)) {
      res.status(400).json({ error: "Invalid event type" });
      return;
    }

    const student = await getStudentForUser(userId);

    await db.insert(dashboardAnalyticsEventsTable).values({
      academyUserId: userId,
      studentId: student?.id ?? null,
      eventType,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to log dashboard analytics event");
    res.status(500).json({ error: "Internal server error" });
  }
});

function parseRegistrationCycle(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : L1_REGISTRATION_CYCLE;
}

router.get("/student/l1-registration", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cycle = parseRegistrationCycle(req.query.cycle);
    const [row] = await db
      .select()
      .from(l1CycleRegistrationsTable)
      .where(
        and(
          eq(l1CycleRegistrationsTable.academyUserId, userId),
          eq(l1CycleRegistrationsTable.cycle, cycle),
          eq(l1CycleRegistrationsTable.level, L1_REGISTRATION_LEVEL),
        ),
      )
      .limit(1);

    res.json({ registration: row ? rowToL1RegistrationResponse(row) : null });
  } catch (err) {
    req.log.error({ err }, "Failed to get L1 registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/student/l1-registration", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cycle = parseRegistrationCycle(req.body?.cycle);
    const validationError = validateL1RegistrationPayload({
      cycle,
      availability: req.body?.availability,
      slotId: req.body?.slotId,
      understandsGc: req.body?.understandsGc,
      willAttend: req.body?.willAttend,
      unavailabilityReason: req.body?.unavailabilityReason,
      notifyNextCycle: req.body?.notifyNextCycle,
    });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const availability = String(req.body.availability).trim();
    const isYes = availability === "yes";
    const slotId = isYes ? String(req.body.slotId).trim() : null;
    const slotLabel = isYes ? slotLabelFor(slotId!) : null;

    const student = await getOrCreateStudentForUser(userId);
    const [basic] = await db
      .select({ userName: academyUserBasicDetailsTable.userName })
      .from(academyUserBasicDetailsTable)
      .where(eq(academyUserBasicDetailsTable.userId, userId))
      .limit(1);

    const displayName = resolveStudentName(
      basic?.userName,
      student?.name,
      userId,
      student?.email,
    );

    const now = new Date();
    const values = {
      academyUserId: userId,
      studentId: student?.id ?? null,
      userName: displayName,
      cycle,
      level: L1_REGISTRATION_LEVEL,
      assessmentDate: L1_REGISTRATION_ASSESSMENT_DATE,
      availability,
      slotId,
      slotLabel,
      understandsGc: isYes && req.body.understandsGc === true ? 1 : null,
      willAttend: isYes && req.body.willAttend === true ? 1 : null,
      unavailabilityReason: !isYes
        ? String(req.body.unavailabilityReason).trim()
        : null,
      notifyNextCycle: !isYes && req.body.notifyNextCycle === true ? 1 : 0,
      submittedAt: now,
      updatedAt: now,
    };

    const [row] = await db
      .insert(l1CycleRegistrationsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [
          l1CycleRegistrationsTable.academyUserId,
          l1CycleRegistrationsTable.cycle,
          l1CycleRegistrationsTable.level,
        ],
        set: {
          studentId: values.studentId,
          userName: values.userName,
          assessmentDate: values.assessmentDate,
          availability: values.availability,
          slotId: values.slotId,
          slotLabel: values.slotLabel,
          understandsGc: values.understandsGc,
          willAttend: values.willAttend,
          unavailabilityReason: values.unavailabilityReason,
          notifyNextCycle: values.notifyNextCycle,
          submittedAt: values.submittedAt,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    res.status(201).json({ registration: rowToL1RegistrationResponse(row) });
  } catch (err) {
    req.log.error({ err }, "Failed to save L1 registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/student/l1-registration", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cycle = parseRegistrationCycle(req.query.cycle);
    await db
      .delete(l1CycleRegistrationsTable)
      .where(
        and(
          eq(l1CycleRegistrationsTable.academyUserId, userId),
          eq(l1CycleRegistrationsTable.cycle, cycle),
          eq(l1CycleRegistrationsTable.level, L1_REGISTRATION_LEVEL),
        ),
      );

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete L1 registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
