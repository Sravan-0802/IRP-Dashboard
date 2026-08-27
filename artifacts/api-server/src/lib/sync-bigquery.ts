import { sql } from "drizzle-orm";
import {
  db,
  academyUserBasicDetailsTable,
  academyUserAssessmentDetailsTable,
  academyUserNxtmockDetailsTable,
  academyUserCourseProgressTable,
  irpL1RoundWiseSummaryTable,
  bigquerySyncStatusTable,
} from "@workspace/db";
import { logger } from "./logger";
import {
  fetchBasicDetails,
  fetchCourseProgress,
  fetchMainAssessmentDetails,
  fetchNxtmockDetails,
  fetchZHustlerAttempts,
  fetchZFeProjectAttempts,
  fetchZNxtmockAttempts,
  fetchZRoundWiseSummary,
  isBigQueryConfigured,
  type ZHustlerAttemptRow,
  type ZFeProjectAttemptRow,
  type ZNxtmockAttemptRow,
} from "./bigquery";

const BASIC_DETAILS_KEY = "academy_user_basic_details";
const COURSE_PROGRESS_KEY = "academy_user_course_progress";
const ASSESSMENT_DETAILS_KEY = "academy_user_assessment_details";
const NXTMOCK_DETAILS_KEY = "academy_user_nxtmock_details";
const ROUND_WISE_SUMMARY_KEY = "irp_l1_round_wise_summary";
const BATCH_SIZE = 500;

function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toReal(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function toDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "object" && v !== null && "value" in v) {
    return toDate((v as { value: unknown }).value);
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function recordStatus(
  tableName: string,
  status: "success" | "error",
  rowCount: number,
  durationMs: number,
  error: string | null
): Promise<void> {
  const now = new Date();
  await db
    .insert(bigquerySyncStatusTable)
    .values({
      tableName,
      status,
      rowCount,
      durationMs,
      error,
      lastSyncedAt: status === "success" ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: bigquerySyncStatusTable.tableName,
      set: {
        status,
        rowCount,
        durationMs,
        error,
        ...(status === "success" ? { lastSyncedAt: now } : {}),
        updatedAt: now,
      },
    });
}

function dedupeByKey<T>(rows: T[], keyFn: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(keyFn(row), row);
  return [...map.values()];
}

async function syncBasicDetails(): Promise<number> {
  const rows = await fetchBasicDetails();
  const mapped = dedupeByKey(
    rows
      .filter((r) => r.user_id != null && String(r.user_id).trim() !== "")
      .map((r) => ({
        userId: String(r.user_id),
        userName: toStr(r.user_name),
        syncedAt: new Date(),
      })),
    (r) => r.userId,
  );

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    await db
      .insert(academyUserBasicDetailsTable)
      .values(batch)
      .onConflictDoUpdate({
        target: academyUserBasicDetailsTable.userId,
        set: {
          userName: sql`excluded.user_name`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return mapped.length;
}

async function syncCourseProgress(): Promise<number> {
  const rows = await fetchCourseProgress();
  const mapped = dedupeByKey(
    rows
      .filter(
        (r) =>
          r.user_id != null &&
          String(r.user_id).trim() !== "" &&
          r.course_id != null &&
          String(r.course_id).trim() !== ""
      )
      .map((r) => ({
        userId: String(r.user_id),
        courseId: String(r.course_id),
        courseTitle: toStr(r.course_title),
        mcqsCompleted: toInt(r.mcqs_completed),
        totalMcqs: toInt(r.total_mcqs),
        mcqCompletionPct: toReal(r.mcq_completion_pct),
        codingProblemsCompleted: toInt(r.coding_problems_completed),
        totalCodingProblems: toInt(r.total_coding_problems),
        codingCompletionPct: toReal(r.coding_completion_pct),
        overallCompleted: toInt(r.overall_completed),
        overallTotal: toInt(r.overall_total),
        overallCompletionPct: toReal(r.overall_completion_pct),
        syncedAt: new Date(),
      })),
    (r) => `${r.userId}:${r.courseId}`,
  );

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    await db
      .insert(academyUserCourseProgressTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          academyUserCourseProgressTable.userId,
          academyUserCourseProgressTable.courseId,
        ],
        set: {
          courseTitle: sql`excluded.course_title`,
          mcqsCompleted: sql`excluded.mcqs_completed`,
          totalMcqs: sql`excluded.total_mcqs`,
          mcqCompletionPct: sql`excluded.mcq_completion_pct`,
          codingProblemsCompleted: sql`excluded.coding_problems_completed`,
          totalCodingProblems: sql`excluded.total_coding_problems`,
          codingCompletionPct: sql`excluded.coding_completion_pct`,
          overallCompleted: sql`excluded.overall_completed`,
          overallTotal: sql`excluded.overall_total`,
          overallCompletionPct: sql`excluded.overall_completion_pct`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return mapped.length;
}

async function syncMainAssessmentDetails(): Promise<number> {
  const rows = await fetchMainAssessmentDetails();
  const mapped = dedupeByKey(
    rows
      .filter(
        (r) =>
          r.user_id != null &&
          String(r.user_id).trim() !== "" &&
          r.organisation_assessment_id != null &&
          String(r.organisation_assessment_id).trim() !== ""
      )
      .map((r) => ({
        userId: String(r.user_id),
        organisationAssessmentId: String(r.organisation_assessment_id),
        assessmentTitle: toStr(r.assessment_title),
        assessmentTag: toStr(r.assessment_tag_str_extracted),
        level: toStr(r.level),
        cycle: toStr(r.cycle),
        assessmentStartDatetime: toDate(r.assessment_start_datetime),
        assessmentEndDatetime: toDate(r.assessment_end_datetime),
        userAssessmentStartDatetime: toDate(r.user_assesment_start_datetime),
        mcqSectionMaxScore: toReal(r.mcq_section_max_score),
        mcqUserSectionScore: toReal(r.mcq_user_section_score),
        mcqAttemptDurationMins: toReal(r.mcq_user_attempt_duration_in_mins),
        codingSectionMaxScore: toReal(r.coding_section_max_score),
        codingUserSectionScore: toReal(r.coding_user_section_score),
        codingAttemptDurationMins: toReal(r.coding_user_attempt_duration_in_mins),
        feSectionMaxScore: toReal(r.fe_section_max_score),
        feUserSectionScore: toReal(r.fe_user_section_score),
        feAttemptDurationMins: toReal(r.fe_user_attempt_duration_in_mins),
        assessmentTotalScore: toReal(r.assessment_total_score),
        assessmentUserScore: toReal(r.assessment_user_score),
        syncedAt: new Date(),
      })),
    (r) => `${r.userId}:${r.organisationAssessmentId}`,
  );

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    await db
      .insert(academyUserAssessmentDetailsTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          academyUserAssessmentDetailsTable.userId,
          academyUserAssessmentDetailsTable.organisationAssessmentId,
        ],
        set: {
          assessmentTitle: sql`excluded.assessment_title`,
          assessmentTag: sql`excluded.assessment_tag`,
          level: sql`excluded.level`,
          cycle: sql`excluded.cycle`,
          assessmentStartDatetime: sql`excluded.assessment_start_datetime`,
          assessmentEndDatetime: sql`excluded.assessment_end_datetime`,
          userAssessmentStartDatetime: sql`excluded.user_assessment_start_datetime`,
          mcqSectionMaxScore: sql`excluded.mcq_section_max_score`,
          mcqUserSectionScore: sql`excluded.mcq_user_section_score`,
          mcqAttemptDurationMins: sql`excluded.mcq_attempt_duration_mins`,
          codingSectionMaxScore: sql`excluded.coding_section_max_score`,
          codingUserSectionScore: sql`excluded.coding_user_section_score`,
          codingAttemptDurationMins: sql`excluded.coding_attempt_duration_mins`,
          feSectionMaxScore: sql`excluded.fe_section_max_score`,
          feUserSectionScore: sql`excluded.fe_user_section_score`,
          feAttemptDurationMins: sql`excluded.fe_attempt_duration_mins`,
          assessmentTotalScore: sql`excluded.assessment_total_score`,
          assessmentUserScore: sql`excluded.assessment_user_score`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return mapped.length;
}

async function syncNxtmockDetails(): Promise<number> {
  const rows = await fetchNxtmockDetails();
  const mapped = dedupeByKey(
    rows
      .filter(
        (r) =>
          r.user_id != null &&
          String(r.user_id).trim() !== "" &&
          r.interview_id != null &&
          String(r.interview_id).trim() !== "",
      )
      .map((r) => ({
        userId: String(r.user_id),
        interviewId: String(r.interview_id),
        interviewTitle: toStr(r.interview_title),
        examType: toStr(r.exam_type),
        level: toStr(r.level),
        cycle: toStr(r.cycle),
        selfIntroRating: toInt(r.self_intro_rating),
        javascriptCodingRating: toInt(r.javascript_coding_rating),
        javascriptRating: toInt(r.javascript_rating),
        cssRating: toInt(r.css_rating),
        htmlRating: toInt(r.html_rating),
        reactJsRating: toInt(r.react_js_rating),
        averageRating: toReal(r.average_rating),
        syncedAt: new Date(),
      })),
    (r) => `${r.userId}:${r.interviewId}`,
  );

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    await db
      .insert(academyUserNxtmockDetailsTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          academyUserNxtmockDetailsTable.userId,
          academyUserNxtmockDetailsTable.interviewId,
        ],
        set: {
          interviewTitle: sql`excluded.interview_title`,
          examType: sql`excluded.exam_type`,
          level: sql`excluded.level`,
          cycle: sql`excluded.cycle`,
          selfIntroRating: sql`excluded.self_intro_rating`,
          javascriptCodingRating: sql`excluded.javascript_coding_rating`,
          javascriptRating: sql`excluded.javascript_rating`,
          cssRating: sql`excluded.css_rating`,
          htmlRating: sql`excluded.html_rating`,
          reactJsRating: sql`excluded.react_js_rating`,
          averageRating: sql`excluded.average_rating`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return mapped.length;
}

/** Derive section max from score + percentage when BQ only sends absolute score. */
function maxFromPct(score: number | null, pct: number | null): number | null {
  if (score == null || pct == null || !(pct > 0)) return null;
  const max = score / (pct / 100);
  return Number.isFinite(max) ? max : null;
}

function mapZHustlerToAssessment(r: ZHustlerAttemptRow) {
  const theoryScore = toReal(r.theory_section_score);
  const theoryPct = toReal(r.theory_section_score_percentage);
  const codingScore = toReal(r.coding_section_score);
  const codingPct = toReal(r.coding_section_score_percentage);
  const cycleParts = [toStr(r.assessment_type), toStr(r.assessment_number)].filter(Boolean);
  return {
    userId: String(r.user_id),
    organisationAssessmentId: String(r.primary_organisation_assessment_id),
    assessmentTitle: toStr(r.assessment_title),
    assessmentTag: toStr(r.assessment_specific_tag),
    level: toStr(r.assessment_level),
    cycle: cycleParts.length ? cycleParts.join("_") : null,
    assessmentStartDatetime: toDate(r.assessment_start_datetime),
    assessmentEndDatetime: null as Date | null,
    userAssessmentStartDatetime: toDate(r.user_assessment_start_datetime),
    mcqSectionMaxScore: maxFromPct(theoryScore, theoryPct),
    mcqUserSectionScore: theoryScore,
    mcqAttemptDurationMins: null as number | null,
    codingSectionMaxScore: maxFromPct(codingScore, codingPct),
    codingUserSectionScore: codingScore,
    codingAttemptDurationMins: null as number | null,
    feSectionMaxScore: null as number | null,
    feUserSectionScore: null as number | null,
    feAttemptDurationMins: null as number | null,
    assessmentTotalScore: toReal(r.assessment_actual_score),
    assessmentUserScore: toReal(r.user_assessment_score),
    attemptNumber: toInt(r.attempt_number),
    assessmentStatus: toStr(r.assessment_status),
    syncedAt: new Date(),
  };
}

function mapZFeToAssessment(r: ZFeProjectAttemptRow) {
  const feScore = toReal(r.react_js_coding_section_score);
  const fePct = toReal(r.react_js_coding_section_score_percentage);
  const feMax =
    maxFromPct(feScore, fePct) ?? toReal(r.assessment_actual_score);
  const cycleParts = [toStr(r.assessment_type), toStr(r.assessment_number)].filter(Boolean);
  return {
    userId: String(r.user_id),
    organisationAssessmentId: String(r.primary_organisation_assessment_id),
    assessmentTitle: toStr(r.assessment_title),
    assessmentTag: toStr(r.assessment_specific_tag),
    level: toStr(r.assessment_level),
    cycle: cycleParts.length ? cycleParts.join("_") : null,
    assessmentStartDatetime: toDate(r.assessment_start_datetime),
    assessmentEndDatetime: null as Date | null,
    userAssessmentStartDatetime: toDate(r.user_assessment_start_datetime),
    mcqSectionMaxScore: null as number | null,
    mcqUserSectionScore: null as number | null,
    mcqAttemptDurationMins: null as number | null,
    codingSectionMaxScore: null as number | null,
    codingUserSectionScore: null as number | null,
    codingAttemptDurationMins: null as number | null,
    feSectionMaxScore: feMax,
    feUserSectionScore: feScore,
    feAttemptDurationMins: null as number | null,
    assessmentTotalScore: toReal(r.assessment_actual_score),
    assessmentUserScore: toReal(r.user_assessment_score),
    attemptNumber: toInt(r.attempt_number),
    assessmentStatus: toStr(r.assessment_status),
    syncedAt: new Date(),
  };
}

const ASSESSMENT_UPSERT_SET = {
  assessmentTitle: sql`excluded.assessment_title`,
  assessmentTag: sql`excluded.assessment_tag`,
  level: sql`excluded.level`,
  cycle: sql`excluded.cycle`,
  assessmentStartDatetime: sql`excluded.assessment_start_datetime`,
  assessmentEndDatetime: sql`excluded.assessment_end_datetime`,
  userAssessmentStartDatetime: sql`excluded.user_assessment_start_datetime`,
  mcqSectionMaxScore: sql`excluded.mcq_section_max_score`,
  mcqUserSectionScore: sql`excluded.mcq_user_section_score`,
  mcqAttemptDurationMins: sql`excluded.mcq_attempt_duration_mins`,
  codingSectionMaxScore: sql`excluded.coding_section_max_score`,
  codingUserSectionScore: sql`excluded.coding_user_section_score`,
  codingAttemptDurationMins: sql`excluded.coding_attempt_duration_mins`,
  feSectionMaxScore: sql`excluded.fe_section_max_score`,
  feUserSectionScore: sql`excluded.fe_user_section_score`,
  feAttemptDurationMins: sql`excluded.fe_attempt_duration_mins`,
  assessmentTotalScore: sql`excluded.assessment_total_score`,
  assessmentUserScore: sql`excluded.assessment_user_score`,
  attemptNumber: sql`excluded.attempt_number`,
  assessmentStatus: sql`excluded.assessment_status`,
  syncedAt: sql`excluded.synced_at`,
} as const;

async function upsertAssessmentMapped(
  mapped: ReturnType<typeof mapZHustlerToAssessment>[],
): Promise<number> {
  const deduped = dedupeByKey(mapped, (r) => `${r.userId}:${r.organisationAssessmentId}`);
  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    await db
      .insert(academyUserAssessmentDetailsTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          academyUserAssessmentDetailsTable.userId,
          academyUserAssessmentDetailsTable.organisationAssessmentId,
        ],
        set: ASSESSMENT_UPSERT_SET,
      });
  }
  return deduped.length;
}

/** Merge IRP 2.0 hustler + FE completed attempts into academy_user_assessment_details. */
async function syncZAssessmentAttempts(): Promise<number> {
  const [hustler, fe] = await Promise.all([fetchZHustlerAttempts(), fetchZFeProjectAttempts()]);
  const mapped = [
    ...hustler
      .filter(
        (r) =>
          r.user_id != null &&
          String(r.user_id).trim() !== "" &&
          r.primary_organisation_assessment_id != null &&
          String(r.primary_organisation_assessment_id).trim() !== "",
      )
      .map(mapZHustlerToAssessment),
    ...fe
      .filter(
        (r) =>
          r.user_id != null &&
          String(r.user_id).trim() !== "" &&
          r.primary_organisation_assessment_id != null &&
          String(r.primary_organisation_assessment_id).trim() !== "",
      )
      .map(mapZFeToAssessment),
  ];
  return upsertAssessmentMapped(mapped);
}

function mapZNxtmock(r: ZNxtmockAttemptRow) {
  const interviewId =
    toStr(r.interview_id) ??
    toStr(r.interview_attempt_id) ??
    `${r.user_id}:${r.interview_number ?? "unknown"}`;
  const skills = parseNxtmockSectionWiseRatings(r.section_wise_rating_json);
  return {
    userId: String(r.user_id),
    interviewId,
    interviewTitle: toStr(r.interview_tag) ?? toStr(r.interview_name),
    examType: toStr(r.interview_program),
    level: toStr(r.interview_level),
    cycle: toStr(r.interview_number),
    selfIntroRating: skills.selfIntroRating,
    javascriptCodingRating: skills.javascriptCodingRating,
    javascriptRating: skills.javascriptRating,
    cssRating: skills.cssRating,
    htmlRating: skills.htmlRating,
    reactJsRating: skills.reactJsRating,
    averageRating: toReal(r.avg_user_interview_rating),
    attemptNumber: toInt(r.attempt_number),
    interviewStatus: toStr(r.interview_status),
    syncedAt: new Date(),
  };
}

/** Parse BQ section_wise_rating_json into discrete skill ratings for the UI. */
function parseNxtmockSectionWiseRatings(raw: unknown): {
  selfIntroRating: number | null;
  javascriptCodingRating: number | null;
  javascriptRating: number | null;
  cssRating: number | null;
  htmlRating: number | null;
  reactJsRating: number | null;
} {
  const empty = {
    selfIntroRating: null as number | null,
    javascriptCodingRating: null as number | null,
    javascriptRating: null as number | null,
    cssRating: null as number | null,
    htmlRating: null as number | null,
    reactJsRating: null as number | null,
  };
  if (raw == null) return empty;
  let obj: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return empty;
    }
  } else if (typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return empty;
  }
  const read = (...keys: string[]): number | null => {
    for (const k of keys) {
      const v = obj[k] ?? obj[k.toLowerCase()] ?? obj[k.toUpperCase()];
      const n = toReal(v);
      if (n != null) return Math.round(n);
    }
    return null;
  };
  return {
    selfIntroRating: read("SELF_INTRO", "self_intro"),
    javascriptCodingRating: read("JAVASCRIPT_CODING", "javascript_coding"),
    javascriptRating: read("JAVASCRIPT", "javascript"),
    cssRating: read("CSS", "css"),
    htmlRating: read("HTML", "html"),
    reactJsRating: read("REACT_JS", "react_js", "REACT"),
  };
}

/** Prefer higher attempt_number when the same interview_id appears twice. */
function dedupeNxtmockPreferLatestAttempt(
  rows: ReturnType<typeof mapZNxtmock>[],
): ReturnType<typeof mapZNxtmock>[] {
  const map = new Map<string, ReturnType<typeof mapZNxtmock>>();
  for (const row of rows) {
    const key = `${row.userId}:${row.interviewId}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    const prevAttempt = prev.attemptNumber ?? -1;
    const nextAttempt = row.attemptNumber ?? -1;
    if (nextAttempt >= prevAttempt) map.set(key, row);
  }
  return [...map.values()];
}

async function syncZNxtmockAttempts(): Promise<number> {
  const rows = await fetchZNxtmockAttempts();
  const mapped = dedupeNxtmockPreferLatestAttempt(
    rows
      .filter((r) => r.user_id != null && String(r.user_id).trim() !== "")
      .map(mapZNxtmock),
  );

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    await db
      .insert(academyUserNxtmockDetailsTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          academyUserNxtmockDetailsTable.userId,
          academyUserNxtmockDetailsTable.interviewId,
        ],
        set: {
          interviewTitle: sql`excluded.interview_title`,
          examType: sql`excluded.exam_type`,
          level: sql`excluded.level`,
          cycle: sql`excluded.cycle`,
          selfIntroRating: sql`excluded.self_intro_rating`,
          javascriptCodingRating: sql`excluded.javascript_coding_rating`,
          javascriptRating: sql`excluded.javascript_rating`,
          cssRating: sql`excluded.css_rating`,
          htmlRating: sql`excluded.html_rating`,
          reactJsRating: sql`excluded.react_js_rating`,
          averageRating: sql`excluded.average_rating`,
          attemptNumber: sql`excluded.attempt_number`,
          interviewStatus: sql`excluded.interview_status`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return mapped.length;
}

async function syncZRoundWiseSummary(): Promise<number> {
  const rows = await fetchZRoundWiseSummary();
  const mapped = dedupeByKey(
    rows
      .filter((r) => r.user_id != null && String(r.user_id).trim() !== "")
      .map((r) => ({
        userId: String(r.user_id),
        hustlerAssessmentStatus: toStr(r.hustler_assessment_status),
        hustlerAssessmentScorePercentage: toReal(r.hustler_assessment_score_percentage),
        hustlerAssessmentNumber: toStr(r.hustler_assessment_number),
        hustlerAssessmentAttemptNumber: toInt(r.hustler_assessment_attempt_number),
        hustlerAssessmentAttemptDate: toDate(r.hustler_assessment_attempt_date),
        hustlerAssessmentTheorySectionAttemptStatus: toStr(
          r.hustler_assessment_theory_section_attempt_status,
        ),
        hustlerAssessmentTheorySectionScore: toReal(r.hustler_assessment_theory_section_score),
        hustlerAssessmentTheorySectionScorePercentage: toReal(
          r.hustler_assessment_theory_section_score_percentage,
        ),
        hustlerAssessmentCodingSectionAttemptStatus: toStr(
          r.hustler_assessment_coding_section_attempt_status,
        ),
        hustlerAssessmentCodingSectionScore: toReal(r.hustler_assessment_coding_section_score),
        hustlerAssessmentCodingSectionScorePercentage: toReal(
          r.hustler_assessment_coding_section_score_percentage,
        ),
        feProjectStatus: toStr(r.fe_project_status),
        feProjectScorePercentage: toReal(r.fe_project_score_percentage),
        feProjectAssessmentNumber: toStr(r.fe_project_assessment_number),
        feProjectAttemptNumber: toInt(r.fe_project_attempt_number),
        feProjectAttemptDate: toDate(r.fe_project_attempt_date),
        feProjectReactJsCodingSectionAttemptStatus: toStr(
          r.fe_project_react_js_coding_section_attempt_status,
        ),
        feProjectReactJsCodingSectionScore: toReal(r.fe_project_react_js_coding_section_score),
        feProjectReactJsCodingSectionScorePercentage: toReal(
          r.fe_project_react_js_coding_section_score_percentage,
        ),
        nxtmockStatus: toStr(r.nxtmock_status),
        nxtmockInterviewRating: toReal(r.nxtmock_interivew_rating),
        nxtmockInterviewNumber: toStr(r.nxtmock_interview_number),
        nxtmockAttemptNumber: toInt(r.nxtmock_attempt_number),
        nxtmockAttemptDate: toDate(r.nxtmock_attempt_date),
        syncedAt: new Date(),
      })),
    (r) => r.userId,
  );

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    await db
      .insert(irpL1RoundWiseSummaryTable)
      .values(batch)
      .onConflictDoUpdate({
        target: irpL1RoundWiseSummaryTable.userId,
        set: {
          hustlerAssessmentStatus: sql`excluded.hustler_assessment_status`,
          hustlerAssessmentScorePercentage: sql`excluded.hustler_assessment_score_percentage`,
          hustlerAssessmentNumber: sql`excluded.hustler_assessment_number`,
          hustlerAssessmentAttemptNumber: sql`excluded.hustler_assessment_attempt_number`,
          hustlerAssessmentAttemptDate: sql`excluded.hustler_assessment_attempt_date`,
          hustlerAssessmentTheorySectionAttemptStatus: sql`excluded.hustler_assessment_theory_section_attempt_status`,
          hustlerAssessmentTheorySectionScore: sql`excluded.hustler_assessment_theory_section_score`,
          hustlerAssessmentTheorySectionScorePercentage: sql`excluded.hustler_assessment_theory_section_score_percentage`,
          hustlerAssessmentCodingSectionAttemptStatus: sql`excluded.hustler_assessment_coding_section_attempt_status`,
          hustlerAssessmentCodingSectionScore: sql`excluded.hustler_assessment_coding_section_score`,
          hustlerAssessmentCodingSectionScorePercentage: sql`excluded.hustler_assessment_coding_section_score_percentage`,
          feProjectStatus: sql`excluded.fe_project_status`,
          feProjectScorePercentage: sql`excluded.fe_project_score_percentage`,
          feProjectAssessmentNumber: sql`excluded.fe_project_assessment_number`,
          feProjectAttemptNumber: sql`excluded.fe_project_attempt_number`,
          feProjectAttemptDate: sql`excluded.fe_project_attempt_date`,
          feProjectReactJsCodingSectionAttemptStatus: sql`excluded.fe_project_react_js_coding_section_attempt_status`,
          feProjectReactJsCodingSectionScore: sql`excluded.fe_project_react_js_coding_section_score`,
          feProjectReactJsCodingSectionScorePercentage: sql`excluded.fe_project_react_js_coding_section_score_percentage`,
          nxtmockStatus: sql`excluded.nxtmock_status`,
          nxtmockInterviewRating: sql`excluded.nxtmock_interview_rating`,
          nxtmockInterviewNumber: sql`excluded.nxtmock_interview_number`,
          nxtmockAttemptNumber: sql`excluded.nxtmock_attempt_number`,
          nxtmockAttemptDate: sql`excluded.nxtmock_attempt_date`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return mapped.length;
}

async function runOne(
  key: string,
  fn: () => Promise<number>
): Promise<{ table: string; status: "success" | "error"; rowCount: number; error?: string }> {
  const start = Date.now();
  try {
    const rowCount = await fn();
    const durationMs = Date.now() - start;
    await recordStatus(key, "success", rowCount, durationMs, null);
    logger.info({ table: key, rowCount, durationMs }, "BigQuery sync completed");
    return { table: key, status: "success", rowCount };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    await recordStatus(key, "error", 0, durationMs, message).catch(() => {});
    logger.error({ table: key, err }, "BigQuery sync failed");
    return { table: key, status: "error", rowCount: 0, error: message };
  }
}

export interface SyncResult {
  ok: boolean;
  results: Array<{ table: string; status: "success" | "error"; rowCount: number; error?: string }>;
}

let syncInProgress = false;

/** Keep serial sequences ahead of max(id) after dump/restore so upserts don't collide on PK. */
async function ensureSerialSequences(): Promise<void> {
  const tables = [
    "academy_user_course_progress",
    "academy_user_assessment_details",
    "academy_user_nxtmock_details",
  ];
  for (const table of tables) {
    try {
      await db.execute(
        sql.raw(
          `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
        ),
      );
    } catch (err) {
      logger.warn({ table, err }, "Could not realign serial sequence before sync");
    }
  }
}

/**
 * Pulls all IRP tables from BigQuery and upserts them into Postgres.
 * Each table is tracked independently so one failure does not block the other.
 */
export async function runBigQuerySync(): Promise<SyncResult> {
  if (!isBigQueryConfigured()) {
    logger.warn("Skipping BigQuery sync: service account env vars not configured");
    return {
      ok: false,
      results: [
        { table: "all", status: "error", rowCount: 0, error: "BigQuery not configured" },
      ],
    };
  }

  if (syncInProgress) {
    return {
      ok: false,
      results: [{ table: "all", status: "error", rowCount: 0, error: "Sync already in progress" }],
    };
  }

  syncInProgress = true;
  try {
    await ensureSerialSequences();
    const results = [
      await runOne(BASIC_DETAILS_KEY, syncBasicDetails),
      await runOne(COURSE_PROGRESS_KEY, syncCourseProgress),
      // Portal assessment sync, then merge IRP 2.0 z_* completed attempts (attempt_number).
      await runOne(ASSESSMENT_DETAILS_KEY, async () => {
        let portal = 0;
        try {
          portal = await syncMainAssessmentDetails();
        } catch (err) {
          logger.warn({ err }, "Portal assessment sync failed; continuing with z_*");
        }
        const zCount = await syncZAssessmentAttempts();
        return Math.max(portal, zCount);
      }),
      await runOne(NXTMOCK_DETAILS_KEY, async () => {
        let portal = 0;
        try {
          portal = await syncNxtmockDetails();
        } catch (err) {
          logger.warn({ err }, "Portal nxtmock sync failed; continuing with z_*");
        }
        const zCount = await syncZNxtmockAttempts();
        return Math.max(portal, zCount);
      }),
      await runOne(ROUND_WISE_SUMMARY_KEY, syncZRoundWiseSummary),
    ];
    return { ok: results.every((r) => r.status === "success"), results };
  } finally {
    syncInProgress = false;
  }
}

let nextRunHandle: ReturnType<typeof setTimeout> | null = null;

const IST_OFFSET_MINUTES = 5 * 60 + 30; // Asia/Kolkata is UTC+05:30 (no DST)
const MINUTES_PER_DAY = 24 * 60;

/**
 * Parses the configured daily sync times (IST) into minutes-of-day in UTC.
 * Override with BQ_SYNC_TIMES_IST, e.g. "10:00,18:00". Defaults to 10:00 & 18:00 IST.
 */
function getSyncTargetsUtcMinutes(): number[] {
  const raw = process.env["BQ_SYNC_TIMES_IST"]?.trim();
  const items = (raw ? raw.split(",") : ["10:00", "18:00"])
    .map((s) => s.trim())
    .filter(Boolean);

  const targets: number[] = [];
  for (const item of items) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(item);
    if (!m) continue;
    const hours = Number(m[1]);
    const mins = Number(m[2]);
    if (hours > 23 || mins > 59) continue;
    const utc = (((hours * 60 + mins - IST_OFFSET_MINUTES) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    targets.push(utc);
  }

  const unique = [...new Set(targets)].sort((a, b) => a - b);
  // Fallback to 10:00 & 18:00 IST if config was empty/invalid.
  return unique.length ? unique : [(10 * 60 - IST_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY, (18 * 60 - IST_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY].sort((a, b) => a - b);
}

function msUntilNextTarget(targetsUtcMinutes: number[]): number {
  const now = new Date();
  const nowMinOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
  const nowSec = now.getUTCSeconds();

  for (const target of targetsUtcMinutes) {
    const deltaMin = target - nowMinOfDay;
    if (deltaMin > 0) {
      return (deltaMin * 60 - nowSec) * 1000;
    }
  }
  // All targets already passed today — schedule the first one tomorrow.
  const minsUntilMidnight = MINUTES_PER_DAY - nowMinOfDay;
  return ((minsUntilMidnight + targetsUtcMinutes[0]) * 60 - nowSec) * 1000;
}

/**
 * Schedules the sync to run at fixed daily times (default 10:00 & 18:00 IST,
 * override with BQ_SYNC_TIMES_IST). Runs once shortly after startup unless
 * BQ_SYNC_ON_BOOT is "false". Failures are logged but never crash the server.
 */
export function startBigQuerySyncScheduler(): void {
  if (!isBigQueryConfigured()) {
    logger.warn("BigQuery sync scheduler not started: service account not configured");
    return;
  }

  const targets = getSyncTargetsUtcMinutes();

  if (process.env["BQ_SYNC_ON_BOOT"] !== "false") {
    // Initial run shortly after boot, off the critical startup path.
    setTimeout(() => {
      runBigQuerySync().catch((err) => logger.error({ err }, "Initial BigQuery sync errored"));
    }, 10_000);
  }

  const scheduleNext = () => {
    const delay = msUntilNextTarget(targets);
    const nextRunAt = new Date(Date.now() + delay).toISOString();
    if (nextRunHandle) clearTimeout(nextRunHandle);
    nextRunHandle = setTimeout(() => {
      runBigQuerySync()
        .catch((err) => logger.error({ err }, "Scheduled BigQuery sync errored"))
        .finally(scheduleNext);
    }, delay);
    logger.info({ nextRunAt, minutesUntil: Math.round(delay / 60000) }, "Next BigQuery sync scheduled");
  };

  scheduleNext();

  const istTimes = targets.map((t) => {
    const ist = (t + IST_OFFSET_MINUTES) % MINUTES_PER_DAY;
    return `${String(Math.floor(ist / 60)).padStart(2, "0")}:${String(ist % 60).padStart(2, "0")}`;
  });
  logger.info({ syncTimesIST: istTimes }, "BigQuery sync scheduler started (daily, IST)");
}
