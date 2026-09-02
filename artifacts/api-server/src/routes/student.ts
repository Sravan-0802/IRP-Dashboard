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
  irpL1RoundWiseSummaryTable,
  contactUsMessagesTable,
  dashboardFeedbackTable,
  dashboardAnalyticsEventsTable,
  l1CycleRegistrationsTable,
  l1ExamAccessTable,
  unpaidUsersTable,
  registrationBatchesTable,
  registrationBatchUsersTable,
} from "@workspace/db";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { resolveAcademyUserId } from "../lib/auth";
import { isInL1July12Cohort } from "../lib/l1July12Cohort";
import { isInL1July12RegistrationUnlock } from "../lib/l1July12RegistrationUnlock";
import { isInL1July26Allowlist } from "../lib/l1July26Allowlist";
import { FE_PROJECT_REDUCED_MIN_SCORE } from "../lib/feProjectReducedThreshold";
import { getStudentAccessGrants } from "../lib/accessBatches";
import { getOrCreateStudentForUser, getStudentForUser, userHasAssessmentData } from "../lib/student";
import { getNxtmockInterviewForUser } from "../lib/nxtmockInterview";
import { getVisibilitySettings, toResponse } from "../lib/visibilitySettings";
import { getGenAiTrainingPopup } from "../lib/genAiTrainingPopup";
import {
  canRegisterForL1July12,
  canRegisterForL1July26,
  L1_AVAILABILITY_VALUES,
  L1_JULY12_REGISTRATION_ASSESSMENT_DATE,
  L1_JULY26_REGISTRATION_ASSESSMENT_DATE,
  L1_JULY12_SLOT_IDS,
  L1_JULY26_SLOT_IDS,
  L1_REGISTRATION_CYCLE,
  L1_REGISTRATION_LEVEL,
  rowToL1RegistrationResponse,
  slotLabelFor,
  validateL1RegistrationPayload,
} from "../lib/l1Registration";
import { getActiveRegistrationBatchForStudent } from "../lib/registrationBatches";
import { isMainAssessmentFields } from "../lib/mainOnly";

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

/** Synthetic ids so the UI can prefer round-wise as the primary result cards. */
export const ROUND_WISE_HUSTLER_ORG_ID = "round-wise:hustler";
export const ROUND_WISE_FE_ORG_ID = "round-wise:fe";

function scoreFromPct(pctVal: number | null | undefined): {
  score: number;
  max: number;
  pct: number;
} | null {
  if (pctVal == null || !Number.isFinite(Number(pctVal))) return null;
  const p = Math.round(Number(pctVal));
  return { score: p, max: 100, pct: p };
}

function sectionFromAbsAndPct(
  abs: number | null | undefined,
  pctVal: number | null | undefined,
): { score: number; max: number; pct: number } {
  const score = abs != null && Number.isFinite(Number(abs)) ? Number(abs) : 0;
  const p = pctVal != null && Number.isFinite(Number(pctVal)) ? Number(pctVal) : null;
  if (p != null && p > 0 && score > 0) {
    const max = score / (p / 100);
    return { score, max: Number.isFinite(max) ? max : 100, pct: Math.round(p) };
  }
  if (p != null) return { score: Math.round(p), max: 100, pct: Math.round(p) };
  return { score, max: score > 0 ? score : 0, pct: 0 };
}

type AssessmentApiRow = {
  organisationAssessmentId: string;
  assessmentTitle: string;
  assessmentTag?: string;
  level: string;
  cycle?: string;
  mcqScore: number;
  mcqMax: number;
  mcqPct: number;
  codingScore: number;
  codingMax: number;
  codingPct: number;
  overallScore: number;
  overallMax: number;
  overallPct: number;
  assessmentStartDatetime?: string;
  hasWrittenAssessment: boolean;
  attemptNumber?: number;
  assessmentStatus?: string;
  assessmentEndDatetime?: string;
  levelNumber: number | null;
};

function cycleFromAssessmentFields(
  cycle: string | null | undefined,
  tag: string | null | undefined,
  title: string | null | undefined,
): string | undefined {
  const direct = cycle?.trim();
  if (direct) return direct;
  const fromTag = tag?.match(/\b(A\d+)\b/i)?.[1];
  if (fromTag) return fromTag.toUpperCase();
  const fromTitle = title?.match(/\b(A\d+)\b/i)?.[1];
  if (fromTitle) return fromTitle.toUpperCase();
  return undefined;
}

function isQualifiedStatus(status: string | null | undefined): boolean {
  if (!status?.trim()) return false;
  return /qualified/i.test(status) && !/not\s*qualified/i.test(status);
}

function isFeAssessmentApiRow(a: AssessmentApiRow): boolean {
  if (a.organisationAssessmentId === ROUND_WISE_FE_ORG_ID) return true;
  if (a.organisationAssessmentId === ROUND_WISE_HUSTLER_ORG_ID) return false;
  const level = (a.level ?? "").toUpperCase();
  const tag = (a.assessmentTag ?? "").toUpperCase();
  const title = (a.assessmentTitle ?? "").toUpperCase();
  return (
    level.includes("FE-PROJECT") ||
    level.includes("FE_PROJECT") ||
    tag.includes("FE-PROJECT") ||
    tag.includes("FE_PROJECT") ||
    title.includes("FE PROJECT") ||
    title.includes("FE-PROJECT") ||
    (title.includes("MAIN II") && (title.includes("IRP") || title.includes("PROJECT")))
  );
}

function isMainAssessmentApiRow(a: AssessmentApiRow): boolean {
  return isMainAssessmentFields({
    title: a.assessmentTitle,
    tag: a.assessmentTag,
  });
}

function mapDetailAssessmentRow(
  a: typeof academyUserAssessmentDetailsTable.$inferSelect,
): AssessmentApiRow {
  const mcqScore = a.mcqUserSectionScore ?? 0;
  const mcqMax = a.mcqSectionMaxScore ?? 0;
  const codingScore = a.codingUserSectionScore ?? 0;
  const codingMax = a.codingSectionMaxScore ?? 0;
  const feScore = a.feUserSectionScore ?? 0;
  const feMax = a.feSectionMaxScore ?? 0;
  const overallScore =
    a.assessmentUserScore ?? (mcqScore + codingScore + feScore || 0);
  const overallMax =
    a.assessmentTotalScore ?? (mcqMax + codingMax + feMax || 0);
  const hasWrittenAssessment =
    a.assessmentUserScore != null ||
    a.mcqUserSectionScore != null ||
    a.codingUserSectionScore != null ||
    a.feUserSectionScore != null ||
    a.attemptNumber != null ||
    (a.assessmentStatus != null &&
      /qualified/i.test(a.assessmentStatus));
  const cycle = cycleFromAssessmentFields(
    a.cycle,
    a.assessmentTag,
    a.assessmentTitle,
  );

  return {
    organisationAssessmentId: a.organisationAssessmentId,
    assessmentTitle: a.assessmentTitle ?? "Assessment",
    assessmentTag: a.assessmentTag ?? cycle ?? undefined,
    level: a.level ?? "",
    cycle,
    mcqScore,
    mcqMax,
    mcqPct: pct(a.mcqUserSectionScore, a.mcqSectionMaxScore),
    codingScore,
    codingMax,
    codingPct: pct(a.codingUserSectionScore, a.codingSectionMaxScore),
    overallScore,
    overallMax,
    overallPct: pct(
      a.assessmentUserScore ?? (mcqScore + codingScore + feScore || null),
      a.assessmentTotalScore ?? (mcqMax + codingMax + feMax || null),
    ),
    assessmentStartDatetime: a.assessmentStartDatetime
      ? a.assessmentStartDatetime.toISOString()
      : a.userAssessmentStartDatetime
        ? a.userAssessmentStartDatetime.toISOString()
        : undefined,
    assessmentEndDatetime: a.assessmentEndDatetime
      ? a.assessmentEndDatetime.toISOString()
      : undefined,
    hasWrittenAssessment,
    attemptNumber: a.attemptNumber ?? undefined,
    assessmentStatus: a.assessmentStatus ?? undefined,
    levelNumber: parseAssessmentLevel(a.level),
  };
}

/**
 * Canonical L1 results from round-wise summary only
 * (`z_academy_irp_2_0_l1_user_round_wise_summary` → irp_l1_round_wise_summary).
 * Cycle + tag = hustler_assessment_number / fe_project_assessment_number only.
 * Status = hustler_assessment_status / fe_project_status. No external tags.
 */
function assessmentsFromRoundWise(
  summary: typeof irpL1RoundWiseSummaryTable.$inferSelect,
): AssessmentApiRow[] {
  const out: AssessmentApiRow[] = [];

  const hustlerStatus = summary.hustlerAssessmentStatus?.trim() || null;
  const hustlerWritten =
    summary.hustlerAssessmentAttemptNumber != null ||
    (hustlerStatus != null && /qualified|not\s*qualified/i.test(hustlerStatus));
  if (hustlerWritten) {
    const theory = sectionFromAbsAndPct(
      summary.hustlerAssessmentTheorySectionScore,
      summary.hustlerAssessmentTheorySectionScorePercentage,
    );
    const coding = sectionFromAbsAndPct(
      summary.hustlerAssessmentCodingSectionScore,
      summary.hustlerAssessmentCodingSectionScorePercentage,
    );
    const overallFromPct = scoreFromPct(summary.hustlerAssessmentScorePercentage);
    const overallScore =
      overallFromPct?.score ?? theory.score + coding.score;
    const overallMax =
      overallFromPct?.max ??
      (theory.max + coding.max > 0 ? theory.max + coding.max : 100);
    const overallPct =
      overallFromPct?.pct ??
      pct(overallScore, overallMax > 0 ? overallMax : null);
    const num = summary.hustlerAssessmentNumber?.trim() || undefined;
    out.push({
      organisationAssessmentId: ROUND_WISE_HUSTLER_ORG_ID,
      assessmentTitle: num
        ? `IRP 2.0 L1 Hustler Assessment ${num}`
        : "IRP 2.0 L1 Hustler Assessment",
      assessmentTag: num,
      level: "L1",
      cycle: num,
      mcqScore: theory.score,
      mcqMax: theory.max,
      mcqPct: theory.pct,
      codingScore: coding.score,
      codingMax: coding.max,
      codingPct: coding.pct,
      overallScore,
      overallMax,
      overallPct,
      assessmentStartDatetime: summary.hustlerAssessmentAttemptDate
        ? summary.hustlerAssessmentAttemptDate.toISOString()
        : undefined,
      hasWrittenAssessment: true,
      attemptNumber: summary.hustlerAssessmentAttemptNumber ?? undefined,
      assessmentStatus: hustlerStatus ?? undefined,
      levelNumber: 1,
    });
  }

  const feStatus = summary.feProjectStatus?.trim() || null;
  const feWritten =
    summary.feProjectAttemptNumber != null ||
    (feStatus != null && /qualified|not\s*qualified/i.test(feStatus));
  if (feWritten) {
    const fe = sectionFromAbsAndPct(
      summary.feProjectReactJsCodingSectionScore,
      summary.feProjectReactJsCodingSectionScorePercentage ??
        summary.feProjectScorePercentage,
    );
    const overallFromPct = scoreFromPct(summary.feProjectScorePercentage);
    const overallScore = overallFromPct?.score ?? fe.score;
    const overallMax = overallFromPct?.max ?? (fe.max > 0 ? fe.max : 20);
    const overallPct = overallFromPct?.pct ?? fe.pct;
    const num = summary.feProjectAssessmentNumber?.trim() || undefined;
    out.push({
      organisationAssessmentId: ROUND_WISE_FE_ORG_ID,
      assessmentTitle: num
        ? `IRP 2.0 FE Project ${num}`
        : "IRP 2.0 FE Project",
      assessmentTag: num,
      level: "L1 FE-PROJECT",
      cycle: num,
      mcqScore: 0,
      mcqMax: 0,
      mcqPct: 0,
      codingScore: 0,
      codingMax: 0,
      codingPct: 0,
      overallScore,
      overallMax,
      overallPct,
      assessmentStartDatetime: summary.feProjectAttemptDate
        ? summary.feProjectAttemptDate.toISOString()
        : undefined,
      hasWrittenAssessment: true,
      attemptNumber: summary.feProjectAttemptNumber ?? undefined,
      assessmentStatus: feStatus ?? undefined,
      levelNumber: 1,
    });
  }

  return out;
}

function isValidL1OnlineDetailRow(a: AssessmentApiRow): boolean {
  if (isFeAssessmentApiRow(a)) return false;
  if ((a.mcqMax ?? 0) > 0 || (a.codingMax ?? 0) > 0) return true;
  return (a.overallMax ?? 0) >= 100;
}

async function getAssessmentResultsResponse(userId: string) {
  if (!(await userHasAssessmentData(userId))) return null;

  let summary: typeof irpL1RoundWiseSummaryTable.$inferSelect | undefined;
  try {
    const summaryRows = await db
      .select()
      .from(irpL1RoundWiseSummaryTable)
      .where(eq(irpL1RoundWiseSummaryTable.userId, userId))
      .limit(1);
    summary = summaryRows[0];
  } catch (err) {
    // Schema may lag a deploy — fall back to detail rows only.
    const text = err instanceof Error ? err.message : String(err);
    if (!/irp_l1_round_wise_summary|does not exist|undefined_table/i.test(text)) throw err;
  }

  const detailRows = await db
    .select()
    .from(academyUserAssessmentDetailsTable)
    .where(eq(academyUserAssessmentDetailsTable.userId, userId));
  const detailAssessments = detailRows
    .filter((r) => r.organisationAssessmentId !== "manual-access-grant")
    .map(mapDetailAssessmentRow)
    .filter(isMainAssessmentApiRow);

  if (!summary) {
    return { assessments: detailAssessments };
  }

  // MAIN-only stage results:
  // 1) Prefer written MAIN detail sits (portal + z_* MAIN sync).
  // 2) Round-wise QUALIFIED is fallback only when no MAIN details exist.
  // 3) Never surface round-wise NOT QUALIFIED alone — it often mirrors MOCK.
  const roundAssessments = assessmentsFromRoundWise(summary);
  const detailMain = detailAssessments.filter(
    (a) => a.hasWrittenAssessment && isMainAssessmentApiRow(a),
  );
  const detailL1 = detailMain.filter(
    (a) => !isFeAssessmentApiRow(a) && isValidL1OnlineDetailRow(a),
  );
  const detailFeMain = detailMain.filter((a) => isFeAssessmentApiRow(a));

  const out: AssessmentApiRow[] = [];
  const roundHustler = roundAssessments.filter(
    (a) => a.organisationAssessmentId === ROUND_WISE_HUSTLER_ORG_ID,
  );
  const roundFe = roundAssessments.filter(
    (a) => a.organisationAssessmentId === ROUND_WISE_FE_ORG_ID,
  );

  if (detailL1.length > 0) {
    out.push(...detailL1);
  } else if (isQualifiedStatus(summary.hustlerAssessmentStatus)) {
    out.push(...roundHustler);
  }

  if (detailFeMain.length > 0) {
    out.push(...detailFeMain);
  } else if (isQualifiedStatus(summary.feProjectStatus)) {
    out.push(...roundFe);
  }

  return { assessments: out };
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
    if (!raw || raw.length > 5000) {
      res.status(400).json({ error: "Message must be 1–5000 characters" });
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
  "nav_assessments_hub",
  "nav_assessment_calendar",
  "feedback_open",
  "contact_us_click",
  "mock_assessment_link_click",
  "l1_july25_mock_start_click",
  "main_assessment_link_click",
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

    // ── Batch registration path ──────────────────────────────────────────────
    const batchIdRaw = req.body?.batchId;
    if (batchIdRaw !== undefined && batchIdRaw !== null) {
      const batchId = typeof batchIdRaw === "number" ? batchIdRaw : Number(batchIdRaw);
      if (!Number.isFinite(batchId) || batchId <= 0) {
        res.status(400).json({ error: "Invalid batchId" });
        return;
      }

      // Load batch
      const [batchRow] = await db
        .select()
        .from(registrationBatchesTable)
        .where(eq(registrationBatchesTable.id, batchId))
        .limit(1);
      if (!batchRow) {
        res.status(404).json({ error: "Registration batch not found" });
        return;
      }
      const batchNow = new Date();
      const batchActive =
        batchRow.enabled === 1 &&
        (batchRow.startsAt === null || batchRow.startsAt <= batchNow) &&
        (batchRow.expiresAt === null || batchRow.expiresAt > batchNow);
      if (!batchActive) {
        res.status(403).json({ error: "This registration batch is not currently active" });
        return;
      }

      // Verify student is in batch
      const [inBatch] = await db
        .select({ academyUserId: registrationBatchUsersTable.academyUserId })
        .from(registrationBatchUsersTable)
        .where(
          and(
            eq(registrationBatchUsersTable.batchId, batchId),
            eq(registrationBatchUsersTable.academyUserId, userId),
          ),
        )
        .limit(1);
      if (!inBatch) {
        res.status(403).json({ error: "You are not in this registration batch" });
        return;
      }

      // Validate (simplified — slot comes from batch, not L1 global slot list)
      const availability = typeof req.body?.availability === "string" ? req.body.availability.trim() : "";
      if (!L1_AVAILABILITY_VALUES.has(availability)) {
        res.status(400).json({ error: "Invalid availability" });
        return;
      }
      const isYes = availability === "yes";
      const isNo = availability.startsWith("no-");
      if (isYes && (req.body.understandsGc !== true || req.body.willAttend !== true)) {
        res.status(400).json({ error: "Please confirm both checkboxes to complete registration" });
        return;
      }
      if (isNo) {
        const reason = typeof req.body.unavailabilityReason === "string" ? req.body.unavailabilityReason.trim() : "";
        if (!reason) {
          res.status(400).json({ error: "Please provide a reason for unavailability" });
          return;
        }
      }

      const batchCycle = 1000 + batchId;
      const batchStudent = await getOrCreateStudentForUser(userId);
      const [batchBasic] = await db
        .select({ userName: academyUserBasicDetailsTable.userName })
        .from(academyUserBasicDetailsTable)
        .where(eq(academyUserBasicDetailsTable.userId, userId))
        .limit(1);
      const batchDisplayName = resolveStudentName(batchBasic?.userName, batchStudent?.name, userId, batchStudent?.email);

      const batchNow2 = new Date();
      const batchValues = {
        academyUserId: userId,
        studentId: batchStudent?.id ?? null,
        userName: batchDisplayName,
        cycle: batchCycle,
        level: L1_REGISTRATION_LEVEL,
        assessmentDate: batchRow.assessmentDate,
        availability,
        slotId: isYes ? batchRow.slotId : null,
        slotLabel: isYes ? batchRow.slotLabel : null,
        understandsGc: isYes && req.body.understandsGc === true ? 1 : null,
        willAttend: isYes && req.body.willAttend === true ? 1 : null,
        unavailabilityReason: isNo ? String(req.body.unavailabilityReason).trim() : null,
        notifyNextCycle: isNo && req.body.notifyNextCycle === true ? 1 : 0,
        batchId,
        submittedAt: batchNow2,
        updatedAt: batchNow2,
      };
      const [batchRow2] = await db
        .insert(l1CycleRegistrationsTable)
        .values(batchValues)
        .onConflictDoUpdate({
          target: [
            l1CycleRegistrationsTable.academyUserId,
            l1CycleRegistrationsTable.cycle,
            l1CycleRegistrationsTable.level,
          ],
          set: {
            availability: batchValues.availability,
            slotId: batchValues.slotId,
            slotLabel: batchValues.slotLabel,
            understandsGc: batchValues.understandsGc,
            willAttend: batchValues.willAttend,
            unavailabilityReason: batchValues.unavailabilityReason,
            notifyNextCycle: batchValues.notifyNextCycle,
            batchId: batchValues.batchId,
            submittedAt: batchValues.submittedAt,
            updatedAt: batchValues.updatedAt,
          },
        })
        .returning();
      res.status(201).json({ registration: rowToL1RegistrationResponse(batchRow2) });
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

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

    const [existing] = await db
      .select({ id: l1CycleRegistrationsTable.id })
      .from(l1CycleRegistrationsTable)
      .where(
        and(
          eq(l1CycleRegistrationsTable.academyUserId, userId),
          eq(l1CycleRegistrationsTable.cycle, cycle),
          eq(l1CycleRegistrationsTable.level, L1_REGISTRATION_LEVEL),
        ),
      )
      .limit(1);

    if (!existing) {
      const canRegister =
        cycle === 3 ? canRegisterForL1July26(userId) :
        cycle === 2 ? canRegisterForL1July12(userId) :
        false;
      if (!canRegister) {
        res.status(403).json({
          error: cycle === 3
            ? "Slot registration for the 26 July assessment is closed"
            : "Slot registration for this cycle is closed",
        });
        return;
      }
    }

    const availability = String(req.body.availability).trim();
    const isYes = availability === "yes";
    const slotId = isYes ? String(req.body.slotId).trim() : null;

    const allowedSlots = cycle === 3 ? L1_JULY26_SLOT_IDS : L1_JULY12_SLOT_IDS;
    if (isYes && (!slotId || !allowedSlots.has(slotId))) {
      res.status(400).json({
        error:
          "Please select the available 6:00 PM – 8:00 PM IST slot for this assessment and submit again.",
      });
      return;
    }

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
      assessmentDate: cycle === 3 ? L1_JULY26_REGISTRATION_ASSESSMENT_DATE : L1_JULY12_REGISTRATION_ASSESSMENT_DATE,
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

// Returns the logged-in student's authoritative exam-platform slot for a cycle,
// used to show the slot-specific MAIN assessment link. Source of truth is the
// uploaded exam-platform list (l1_exam_access), not the self-service registration.
router.get("/student/l1-exam-access", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cycle = parseRegistrationCycle(req.query.cycle);
    const [row] = await db
      .select({ slotId: l1ExamAccessTable.slotId })
      .from(l1ExamAccessTable)
      .where(
        and(
          eq(l1ExamAccessTable.academyUserId, userId),
          eq(l1ExamAccessTable.cycle, cycle),
        ),
      )
      .limit(1);

    res.json({ examAccess: row ? { slotId: row.slotId } : null });
  } catch (err) {
    req.log.error({ err }, "Failed to get L1 exam access");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Whether the logged-in student is part of the fixed 12 July 2026 (Cycle 2)
// assessment cohort. These students see an "already registered" confirmation.
// Membership is an uploaded list, not self-service registration.
router.get("/student/l1-july12-cohort", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.json({
      registered: isInL1July12Cohort(userId),
      registrationUnlocked: isInL1July12RegistrationUnlock(userId),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get L1 July 12 cohort status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Whether the logged-in student is in the July 26 2026 (Cycle 3) registration allowlist.
router.get("/student/l1-july26-allowlist", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ allowed: isInL1July26Allowlist(userId) });
  } catch (err) {
    req.log.error({ err }, "Failed to get L1 July 26 allowlist status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/student/fe-project-config — FE Project clearing threshold for this user.
// All FE sits clear at ≥18/20.
router.get("/student/fe-project-config", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ minScore: FE_PROJECT_REDUCED_MIN_SCORE });
  } catch (err) {
    req.log.error({ err }, "Failed to get fe project config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/student/access — admin stage access grants for the current user
router.get("/student/access", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const grants = await getStudentAccessGrants(userId);
    res.json({ grants });
  } catch (err) {
    req.log.error({ err }, "Failed to get student access grants");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/student/visibility-settings — admin-controlled result visibility flags.
// Data still syncs; these flags decide what the student UI may show.
router.get("/student/visibility-settings", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { map, releaseAtByKey, updatedAt, syncByTable } = await getVisibilitySettings({
      includeCounts: false,
    });
    res.json(toResponse(map, releaseAtByKey, updatedAt, syncByTable));
  } catch (err) {
    req.log.error({ err }, "Failed to get visibility settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/student/genai-training-popup — admin-managed GenAI Training pop-up content.
router.get("/student/genai-training-popup", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(await getGenAiTrainingPopup());
  } catch (err) {
    req.log.error({ err }, "Failed to get GenAI training popup");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/student/nxtmock-interview — AI Mock Interview ratings synced from BigQuery.
router.get("/student/nxtmock-interview", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const interview = await getNxtmockInterviewForUser(userId);
    res.json({ interview });
  } catch (err) {
    req.log.error({ err }, "Failed to get NxtMock interview");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/student/payment-status — whether the current user has completed
// payment. Unpaid users are gated behind a "complete your payment" prompt.
router.get("/student/payment-status", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [row] = await db
      .select({ academyUserId: unpaidUsersTable.academyUserId })
      .from(unpaidUsersTable)
      .where(eq(unpaidUsersTable.academyUserId, userId))
      .limit(1);

    res.json({ paid: !row });
  } catch (err) {
    req.log.error({ err }, "Failed to get payment status");
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

// GET /api/student/registration-batch — first active registration batch for the student
router.get("/student/registration-batch", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const result = await getActiveRegistrationBatchForStudent(userId);
    if (!result) {
      res.json({ batch: null, hasResponded: false });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get registration batch for student");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
