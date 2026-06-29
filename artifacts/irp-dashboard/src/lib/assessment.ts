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

export function pickAssessmentForLevel(
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
): AssessmentResult | null {
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
  return !resultsUnlockedByDate || !hasWrittenAssessment(assessments, level);
}
