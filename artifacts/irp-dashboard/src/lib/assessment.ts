import type { AssessmentResult } from "@workspace/api-client-react";
import { LEVEL_META } from "@/lib/journey";
import {
  EXAM_DATE_LABEL,
  L1_AUG9_EXAM_DATE_LABEL,
  L1_AUG9_ORG_ASSESSMENT_ID,
  L1_CYCLE1_EXAM_DATE_LABEL,
  L1_CYCLE2_EXAM_DATE_LABEL,
  L1_JUNE14_ORG_ASSESSMENT_ID,
  L1_JULY12_EXAM_DATE_LABEL,
  L1_JULY12_ORG_ASSESSMENT_ID,
  L1_JULY26_EXAM_DATE_LABEL,
  L1_JULY26_ORG_ASSESSMENT_ID,
} from "@/lib/irpDates";
import {
  FE_AUG5_ORG_ASSESSMENT_ID,
  FE_PROJECT_CLEAR_MIN_SCORE,
  FE_PROJECT_MAIN_II_ORG_ASSESSMENT_ID,
  FE_PROJECT_MOCK_ORG_ASSESSMENT_ID,
  normalizeOrgAssessmentId,
} from "@/lib/feProjectConfig";
/** Minimum overall % (assessment_user_score / assessment_total_score) to count as cleared. */
export const ASSESSMENT_CLEAR_THRESHOLD = 70;

/** Synthetic org ids from GET /api/student/assessments when round-wise is the results source. */
export const ROUND_WISE_HUSTLER_ORG_ID = "round-wise:hustler";
export const ROUND_WISE_FE_ORG_ID = "round-wise:fe";

export function isRoundWiseHustlerResult(a: AssessmentResult): boolean {
  return a.organisationAssessmentId === ROUND_WISE_HUSTLER_ORG_ID;
}

export function isRoundWiseFeResult(a: AssessmentResult): boolean {
  return a.organisationAssessmentId === ROUND_WISE_FE_ORG_ID;
}

/** BigQuery sometimes stores organisation_assessment_id in assessment_title — hide for display. */
export function formatAssessmentTitle(
  title: string | null | undefined,
  level: 1 | 2 | 3,
): string {
  const fallback = `${LEVEL_META[level].name} online assessment`;
  if (!title?.trim()) return fallback;
  const t = title.trim();
  if (/^[0-9a-f]{32}$/i.test(t)) return fallback;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return fallback;
  return t;
}

export function parseAssessmentLevel(level: string | null | undefined): number | null {
  if (!level?.trim()) return null;
  const v = level.trim();
  const levelWord = /level\s*(\d+)/i.exec(v);
  if (levelWord) {
    const n = Number(levelWord[1]);
    return n >= 1 && n <= 3 ? (n as 1 | 2 | 3) : null;
  }
  const lPrefix = /^L(\d+)/i.exec(v);
  if (lPrefix) {
    const n = Number(lPrefix[1]);
    return n >= 1 && n <= 3 ? (n as 1 | 2 | 3) : null;
  }
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return n >= 1 && n <= 3 ? (n as 1 | 2 | 3) : null;
  }
  return null;
}

function scoreRank(assessment: AssessmentResult): number {
  if (assessmentWasWritten(assessment)) return assessment.overallScore;
  return -1;
}

/** True for L1 Hustler online assessment rows — excludes FE Project attempts. */
export function isL1OnlineAssessment(a: AssessmentResult): boolean {
  if (isRoundWiseHustlerResult(a)) return true;
  if (isRoundWiseFeResult(a)) return false;
  const level = (a.level ?? "").toUpperCase();
  const tag = (a.assessmentTag ?? "").toUpperCase();
  if (level.includes("FE-PROJECT") || level.includes("FE_PROJECT") || tag.includes("FE-PROJECT")) {
    return false;
  }
  if (level.includes("ASSESSMENT") || tag.includes("ASSESSMENT")) return true;
  return parseAssessmentLevel(a.level) === 1 && !level.includes("FE");
}

/** Known FE Project organisation_assessment_id values (hyphens stripped). */
const FE_PROJECT_ORG_IDS = new Set([
  normalizeOrgAssessmentId(FE_AUG5_ORG_ASSESSMENT_ID),
  normalizeOrgAssessmentId(FE_PROJECT_MAIN_II_ORG_ASSESSMENT_ID),
  normalizeOrgAssessmentId(FE_PROJECT_MOCK_ORG_ASSESSMENT_ID),
]);

/** True for FE Project assessment rows (Main / Main II / A4 / known FE org windows). */
export function isFeProjectAssessment(a: AssessmentResult): boolean {
  if (isRoundWiseFeResult(a)) return true;
  if (isRoundWiseHustlerResult(a)) return false;
  const orgId = normalizeOrgAssessmentId(a.organisationAssessmentId);
  if (orgId && FE_PROJECT_ORG_IDS.has(orgId)) return true;

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
    // BigQuery sometimes omits "FE Project" and only says Main / Main II.
    (title.includes("MAIN II") && (title.includes("IRP") || title.includes("PROJECT"))) ||
    (title.includes("FE ") && title.includes("MAIN"))
  );
}

/** 5 Aug 2026 FE Project Main (A4) assessment window. */
export function isFeProjectAug5A4Assessment(a: AssessmentResult): boolean {
  if (
    normalizeOrgAssessmentId(a.organisationAssessmentId) ===
    normalizeOrgAssessmentId(FE_AUG5_ORG_ASSESSMENT_ID)
  ) {
    return true;
  }
  const tag = (a.assessmentTag ?? "").toUpperCase();
  return tag.includes("FE-PROJECT_A4");
}

/**
 * Featured FE Project row for the dashboard: latest attempt by start date
 * (then score). Clearance uses {@link hasClearedFeProject} (any sit ≥ threshold).
 */
export function pickFeProjectAssessment(
  assessments: AssessmentResult[],
): AssessmentResult | null {
  const roundWise = assessments.find(isRoundWiseFeResult);
  if (roundWise && (roundWise.hasWrittenAssessment || feAssessmentWasWritten(roundWise))) {
    return roundWise;
  }
  const attempted = listAttemptedFeProjectAssessments(assessments);
  if (attempted.length > 0) return attempted[0];

  const registered = assessments
    .filter(isFeProjectAssessment)
    .filter((a) => !isRoundWiseFeResult(a))
    .sort((a, b) => assessmentStartMs(b) - assessmentStartMs(a));
  return registered[0] ?? null;
}

/**
 * All FE Project sits that were attempted, newest first.
 * Used for FE Results history; the main card shows the latest sit.
 */
export function listAttemptedFeProjectAssessments(
  assessments: AssessmentResult[],
): AssessmentResult[] {
  return assessments
    .filter(isFeProjectAssessment)
    .filter((a) => !isRoundWiseFeResult(a))
    .filter(feAssessmentWasWritten)
    .sort((a, b) => {
      const dateDiff = assessmentStartMs(b) - assessmentStartMs(a);
      if (dateDiff !== 0) return dateDiff;
      return scoreRank(b) - scoreRank(a);
    });
}

/**
 * FE Project counts as *attempted* only with a positive score. A synced row that
 * exists with score 0 (and no section scores) means the student was registered /
 * assigned the project but has not submitted — treated as "in progress", not attempted.
 */
function feAssessmentWasWritten(assessment: AssessmentResult): boolean {
  return (
    (assessment.overallScore ?? 0) > 0 ||
    (assessment.mcqScore ?? 0) > 0 ||
    (assessment.codingScore ?? 0) > 0
  );
}

export function hasAttemptedFeProject(assessments: AssessmentResult[]): boolean {
  return assessments.some((a) => isFeProjectAssessment(a) && feAssessmentWasWritten(a));
}

/**
 * Student has an FE Project row (assigned / registered) but has not attempted it yet
 * (no positive score). These students see the FE Project step as "In progress".
 */
export function hasRegisteredFeProjectNotAttempted(assessments: AssessmentResult[]): boolean {
  const fe = pickFeProjectAssessment(assessments);
  return fe != null && !feAssessmentWasWritten(fe);
}

/** True when a single FE assessment sit clears (overallScore ≥ threshold). */
export function hasClearedFeSit(
  assessment: AssessmentResult,
  minScore: number = FE_PROJECT_CLEAR_MIN_SCORE,
): boolean {
  if (!feAssessmentWasWritten(assessment)) return false;
  return assessment.overallScore >= minScore;
}

/**
 * FE Project clears when any attempted FE sit reaches ≥ minScore (default 18/20).
 * Clearance is not limited to the latest sit — an earlier ≥18 clears the stage.
 */
export function hasClearedFeProject(
  assessments: AssessmentResult[],
  minScore?: number | null,
): boolean {
  const threshold = minScore ?? FE_PROJECT_CLEAR_MIN_SCORE;
  return listAttemptedFeProjectAssessments(assessments).some((fe) =>
    hasClearedFeSit(fe, threshold),
  );
}

export function feResultLabel(
  assessment: AssessmentResult,
  minScore: number = FE_PROJECT_CLEAR_MIN_SCORE,
): "Cleared" | "Not cleared" {
  return hasClearedFeSit(assessment, minScore) ? "Cleared" : "Not cleared";
}

export function feResultTone(
  assessment: AssessmentResult,
  minScore: number = FE_PROJECT_CLEAR_MIN_SCORE,
): "green" | "amber" {
  return hasClearedFeSit(assessment, minScore) ? "green" : "amber";
}

export function pickL1Cycle2Assessment(assessments: AssessmentResult[]): AssessmentResult | null {
  const c2 = assessments
    .filter(isL1OnlineAssessment)
    .filter((a) => assessmentCycle(a) === "C2")
    .sort((a, b) => scoreRank(b) - scoreRank(a));
  return c2[0] ?? null;
}

/** True when the student has a written 5 July (Cycle 2) L1 online assessment row. */
export function hasAttemptedL1Cycle2(assessments: AssessmentResult[]): boolean {
  const c2 = pickL1Cycle2Assessment(assessments);
  return c2 != null && assessmentWasWritten(c2);
}

/** Prefer the Cycle 2 sit for results once online L1 results are visible (admin flag). */
export function pickL1AssessmentForResults(
  assessments: AssessmentResult[],
  onlineL1ResultsVisible = true,
): AssessmentResult | null {
  if (onlineL1ResultsVisible && hasAttemptedL1Cycle2(assessments)) {
    const showCycle2Sit =
      !hasClearedAssessment(assessments, 1) || clearedL1ViaC2(assessments);
    if (showCycle2Sit) return pickL1Cycle2Assessment(assessments);
  }
  return pickAssessmentForLevel(assessments, 1);
}

export function pickAssessmentForLevel(
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
): AssessmentResult | null {
  if (level === 1) {
    const roundWise = assessments.find(isRoundWiseHustlerResult);
    if (roundWise && (roundWise.hasWrittenAssessment || assessmentWasWritten(roundWise))) {
      return roundWise;
    }
    const online = assessments.filter(isL1OnlineAssessment);
    const written = online
      .filter((a) => !isRoundWiseHustlerResult(a))
      .filter(assessmentWasWritten)
      .sort((a, b) => {
        const dateDiff = assessmentStartMs(b) - assessmentStartMs(a);
        if (dateDiff !== 0) return dateDiff;
        return scoreRank(b) - scoreRank(a);
      });
    if (written.length > 0) return written[0];

    const byDate = [...online]
      .filter((a) => !isRoundWiseHustlerResult(a))
      .sort((a, b) => assessmentStartMs(b) - assessmentStartMs(a));
    if (byDate.length > 0) return byDate[0];
  }

  const forLevel = assessments
    .filter((a) => parseAssessmentLevel(a.level) === level)
    .sort((a, b) => scoreRank(b) - scoreRank(a));
  if (forLevel.length > 0) return forLevel[0];

  const unlabeled = assessments.filter((a) => parseAssessmentLevel(a.level) === null);
  if (unlabeled.length === 1) return unlabeled[0];

  return null;
}

/**
 * All L1 online sits that were attempted, newest first.
 * Used for Assessment Results history; clearance still uses pickAssessmentForLevel (latest only).
 */
export function listAttemptedL1OnlineAssessments(
  assessments: AssessmentResult[],
): AssessmentResult[] {
  return assessments
    .filter(isL1OnlineAssessment)
    .filter((a) => !isRoundWiseHustlerResult(a))
    .filter(assessmentWasWritten)
    .sort((a, b) => {
      const dateDiff = assessmentStartMs(b) - assessmentStartMs(a);
      if (dateDiff !== 0) return dateDiff;
      return scoreRank(b) - scoreRank(a);
    });
}

function assessmentWasWritten(assessment: AssessmentResult): boolean {
  if (assessment.hasWrittenAssessment === true) return true;
  if (assessment.hasWrittenAssessment === false) return false;
  return (
    assessment.overallMax > 0 &&
    (assessment.overallScore > 0 || assessment.mcqScore > 0 || assessment.codingScore > 0)
  );
}

export function assessmentOverallPct(assessment: AssessmentResult): number {
  if (assessment.overallMax > 0) {
    return Math.round((assessment.overallScore / assessment.overallMax) * 100);
  }
  return Math.round(assessment.overallPct);
}

export function hasWrittenAssessment(
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
): boolean {
  const assessment = pickAssessmentForLevel(assessments, level);
  if (!assessment) return false;
  return assessmentWasWritten(assessment);
}

export function hasClearedAssessment(
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
): boolean {
  const assessment = pickAssessmentForLevel(assessments, level);
  if (!assessment || !assessmentWasWritten(assessment)) return false;
  return assessmentOverallPct(assessment) >= ASSESSMENT_CLEAR_THRESHOLD;
}

/** True when the student's best L1 online sit is a cleared Cycle 2 row. */
export function clearedL1ViaC2(assessments: AssessmentResult[]): boolean {
  const assessment = pickAssessmentForLevel(assessments, 1);
  if (!assessment || !assessmentWasWritten(assessment)) return false;
  if (assessmentOverallPct(assessment) < ASSESSMENT_CLEAR_THRESHOLD) return false;
  return assessmentCycle(assessment) === "C2";
}

function assessmentCycle(assessment: AssessmentResult | null | undefined): string {
  return (assessment?.cycle ?? "").trim().toUpperCase();
}

function assessmentStartMs(assessment: AssessmentResult | null | undefined): number {
  const raw = assessment?.assessmentStartDatetime;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Ordinal day label like "9th August 2026" in Asia/Kolkata. */
export function formatExamDateLabelFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(d);
  const day = Number(parts.find((p) => p.type === "day")?.value ?? NaN);
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  if (!Number.isFinite(day) || !month || !year) return null;
  const j = day % 10;
  const k = day % 100;
  const ord =
    j === 1 && k !== 11 ? "st" : j === 2 && k !== 12 ? "nd" : j === 3 && k !== 13 ? "rd" : "th";
  return `${day}${ord} ${month} ${year}`;
}

/** Returns the exam date label for a given assessment row. */
function examDateLabelForAssessment(assessment: AssessmentResult | null | undefined): string {
  if (!assessment) return EXAM_DATE_LABEL;

  const fromIso = formatExamDateLabelFromIso(assessment.assessmentStartDatetime);
  if (fromIso) return fromIso;

  const orgId = assessment.organisationAssessmentId;
  if (orgId === L1_AUG9_ORG_ASSESSMENT_ID) return L1_AUG9_EXAM_DATE_LABEL;
  if (orgId === L1_JULY26_ORG_ASSESSMENT_ID) return L1_JULY26_EXAM_DATE_LABEL;
  if (orgId === L1_JULY12_ORG_ASSESSMENT_ID) return L1_JULY12_EXAM_DATE_LABEL;
  if (orgId === L1_JUNE14_ORG_ASSESSMENT_ID) return L1_CYCLE1_EXAM_DATE_LABEL;
  if (assessmentCycle(assessment) === "C2") return L1_CYCLE2_EXAM_DATE_LABEL;
  return L1_CYCLE1_EXAM_DATE_LABEL;
}

/** Public helper — exam date label for a specific assessment sit. */
export function getExamDateLabelForAssessment(
  assessment: AssessmentResult | null | undefined,
): string {
  return examDateLabelForAssessment(assessment);
}

/** Exam date label for the sit that cleared L1 (Cycle 1 vs Cycle 2). */
export function getL1ClearedExamDateLabel(assessments: AssessmentResult[]): string {
  const assessment = pickAssessmentForLevel(assessments, 1);
  return examDateLabelForAssessment(assessment);
}

/** Date label for assessment results — Cycle 1 sit vs Cycle 2 upcoming. */
export function getAssessmentCompletedDateLabel(
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
  upcomingLabel = EXAM_DATE_LABEL,
): string {
  if (level === 1 && (hasClearedAssessment(assessments, 1) || hasWrittenAssessment(assessments, 1))) {
    const assessment = pickAssessmentForLevel(assessments, 1);
    return examDateLabelForAssessment(assessment);
  }
  return upcomingLabel;
}

export function resultLabel(pct: number): "Cleared" | "Not cleared" {
  return pct >= ASSESSMENT_CLEAR_THRESHOLD ? "Cleared" : "Not cleared";
}

export function resultTone(pct: number): "green" | "amber" {
  return pct >= ASSESSMENT_CLEAR_THRESHOLD ? "green" : "amber";
}

export function getAssessmentStepStatus(
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
): "done" | "attempted_not_cleared" | "active" {
  if (!hasWrittenAssessment(assessments, level)) return "active";
  if (hasClearedAssessment(assessments, level)) return "done";
  return "attempted_not_cleared";
}

export function isAssessmentResultsLocked(
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
  resultsUnlockedByDate: boolean,
  onlineL1ResultsVisible = true,
): boolean {
  if (!hasWrittenAssessment(assessments, level)) return true;
  // Cleared students always see their Online L1 scores (never the processing banner).
  if (hasClearedAssessment(assessments, level)) return false;
  // July 12 / Cycle 2 sit: not-cleared scores stay locked until admin releases.
  if (level === 1 && hasAttemptedL1Cycle2(assessments) && !onlineL1ResultsVisible) {
    return true;
  }
  if (level === 1 && hasWrittenAssessment(assessments, 1)) return false;
  return !resultsUnlockedByDate;
}
