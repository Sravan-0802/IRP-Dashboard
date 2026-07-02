import type { AssessmentResult } from "@workspace/api-client-react";
import { LEVEL_META } from "@/lib/journey";
import {
  EXAM_DATE_LABEL,
  L1_CYCLE1_EXAM_DATE_LABEL,
} from "@/lib/irpDates";

/** Minimum overall % (assessment_user_score / assessment_total_score) to count as cleared. */
export const ASSESSMENT_CLEAR_THRESHOLD = 70;

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
  const level = (a.level ?? "").toUpperCase();
  const tag = (a.assessmentTag ?? "").toUpperCase();
  if (level.includes("FE-PROJECT") || level.includes("FE_PROJECT") || tag.includes("FE-PROJECT")) {
    return false;
  }
  if (level.includes("ASSESSMENT") || tag.includes("ASSESSMENT")) return true;
  return parseAssessmentLevel(a.level) === 1 && !level.includes("FE");
}

/** True for FE Project assessment rows (Main / Main II). */
export function isFeProjectAssessment(a: AssessmentResult): boolean {
  const level = (a.level ?? "").toUpperCase();
  const tag = (a.assessmentTag ?? "").toUpperCase();
  const title = (a.assessmentTitle ?? "").toUpperCase();
  return (
    level.includes("FE-PROJECT") ||
    level.includes("FE_PROJECT") ||
    tag.includes("FE-PROJECT") ||
    title.includes("FE PROJECT")
  );
}

export function pickFeProjectAssessment(assessments: AssessmentResult[]): AssessmentResult | null {
  const fe = assessments
    .filter(isFeProjectAssessment)
    .sort((a, b) => {
      const aMainII = (a.assessmentTitle ?? "").toLowerCase().includes("main ii") ? 1 : 0;
      const bMainII = (b.assessmentTitle ?? "").toLowerCase().includes("main ii") ? 1 : 0;
      if (bMainII !== aMainII) return bMainII - aMainII;
      return scoreRank(b) - scoreRank(a);
    });
  return fe[0] ?? null;
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
  const fe = pickFeProjectAssessment(assessments);
  return fe != null && feAssessmentWasWritten(fe);
}

/**
 * Student has an FE Project row (assigned / registered) but has not attempted it yet
 * (no positive score). These students see the FE Project step as "In progress".
 */
export function hasRegisteredFeProjectNotAttempted(assessments: AssessmentResult[]): boolean {
  const fe = pickFeProjectAssessment(assessments);
  return fe != null && !feAssessmentWasWritten(fe);
}

/**
 * FE Project clears only on a perfect score — every test case must pass
 * (e.g. 20/20). A partial score counts as attempted-but-not-cleared.
 */
export function hasClearedFeProject(assessments: AssessmentResult[]): boolean {
  const fe = pickFeProjectAssessment(assessments);
  if (!fe || !feAssessmentWasWritten(fe)) return false;
  return fe.overallMax > 0 && fe.overallScore >= fe.overallMax;
}

export function pickAssessmentForLevel(
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
): AssessmentResult | null {
  if (level === 1) {
    const online = assessments
      .filter(isL1OnlineAssessment)
      .sort((a, b) => scoreRank(b) - scoreRank(a));
    if (online.length > 0) return online[0];
  }

  const forLevel = assessments
    .filter((a) => parseAssessmentLevel(a.level) === level)
    .sort((a, b) => scoreRank(b) - scoreRank(a));
  if (forLevel.length > 0) return forLevel[0];

  const unlabeled = assessments.filter((a) => parseAssessmentLevel(a.level) === null);
  if (unlabeled.length === 1) return unlabeled[0];

  return null;
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

/** Date label for assessment results — Cycle 1 sit vs Cycle 2 upcoming. */
export function getAssessmentCompletedDateLabel(
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
  upcomingLabel = EXAM_DATE_LABEL,
): string {
  if (level === 1 && hasClearedAssessment(assessments, 1)) {
    return L1_CYCLE1_EXAM_DATE_LABEL;
  }
  if (level === 1 && hasWrittenAssessment(assessments, 1)) {
    return L1_CYCLE1_EXAM_DATE_LABEL;
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
): boolean {
  if (!hasWrittenAssessment(assessments, level)) return true;
  // L1 Cycle 1 sit complete (cleared or attempted-not-cleared) — show scores immediately.
  if (level === 1 && hasWrittenAssessment(assessments, 1)) return false;
  return !resultsUnlockedByDate;
}
