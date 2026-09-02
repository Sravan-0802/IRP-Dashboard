import type { AssessmentResult } from "@workspace/api-client-react";
import {
  assessmentOverallPct,
  feResultLabel,
  getAssessmentStatusTag,
  hasClearedAssessment,
  hasClearedFeSit,
  isAssessmentSitCleared,
  ASSESSMENT_CLEAR_THRESHOLD,
} from "@/lib/assessment";
import { FE_PROJECT_CLEAR_MIN_SCORE } from "@/lib/feProjectConfig";
import type { NxtmockInterview } from "@/lib/nxtmockInterview";
import { isNxtmockCleared } from "@/lib/nxtmockInterview";

/** Normalize BQ / round-wise status strings for student-facing UI. */
export function normalizeQualificationStatus(raw: string | null | undefined): string | null {
  const status = raw?.trim();
  if (!status) return null;
  if (/^A\d+$/i.test(status)) return null;
  if (/not\s*qualified/i.test(status)) return "Not qualified";
  if (/\bqualified\b/i.test(status) && !/not\s*qualified/i.test(status)) return "Qualified";
  if (/cleared/i.test(status) && !/not\s*cleared/i.test(status)) return "Cleared";
  if (/not\s*cleared/i.test(status)) return "Not cleared";
  if (/^A\d+\s/i.test(status)) {
    return normalizeQualificationStatus(status.replace(/^A\d+\s*/i, ""));
  }
  return null;
}

export function formatL1OnlineStatus(assessment: AssessmentResult | null | undefined): string {
  if (!assessment) return "Not attempted";
  const fromTag = normalizeQualificationStatus(getAssessmentStatusTag(assessment));
  if (fromTag) return fromTag;
  return isAssessmentSitCleared(assessment) ? "Qualified" : "Not qualified";
}

export function formatL1OnlineStatusForAssessments(assessments: AssessmentResult[]): string {
  if (!hasClearedAssessment(assessments, 1)) {
    const latest = assessments.find((a) => a.hasWrittenAssessment);
    return latest ? formatL1OnlineStatus(latest) : "Not attempted";
  }
  return "Qualified";
}

export function formatFeProjectStatus(
  assessment: AssessmentResult | null | undefined,
  minScore: number = FE_PROJECT_CLEAR_MIN_SCORE,
): string {
  if (!assessment) return "Not attempted";
  const fromTag = normalizeQualificationStatus(getAssessmentStatusTag(assessment));
  if (fromTag === "Qualified" || fromTag === "Cleared") return "Cleared";
  if (fromTag === "Not qualified" || fromTag === "Not cleared") return "Not cleared";
  const label = feResultLabel(assessment, minScore);
  if (label === "Cleared") return "Cleared";
  if (label === "Not cleared") return "Not cleared";
  return hasClearedFeSit(assessment, minScore) ? "Cleared" : "Not cleared";
}

export function formatNxtmockStatus(interview: NxtmockInterview | null | undefined): string {
  if (!interview) return "Not attempted";
  return isNxtmockCleared(interview) ? "Cleared" : "Not cleared";
}

export function l1OnlineStatusTone(
  assessment: AssessmentResult | null | undefined,
): "green" | "amber" | "grey" {
  const label = formatL1OnlineStatus(assessment);
  if (label === "Qualified") return "green";
  if (label === "Not qualified") return "amber";
  return "grey";
}

export function feProjectStatusTone(
  assessment: AssessmentResult | null | undefined,
  minScore?: number | null,
): "green" | "amber" | "grey" {
  const label = formatFeProjectStatus(assessment, minScore ?? FE_PROJECT_CLEAR_MIN_SCORE);
  if (label === "Cleared") return "green";
  if (label === "Not cleared") return "amber";
  return "grey";
}

/** Student-facing result pill text for score cards (no cycle tags like A5). */
export function studentResultStatusLabel(
  assessment: AssessmentResult,
  minScore?: number,
): string {
  const fromTag = normalizeQualificationStatus(getAssessmentStatusTag(assessment));
  if (fromTag) return fromTag;
  const pct = assessmentOverallPct(assessment);
  const threshold = minScore ?? ASSESSMENT_CLEAR_THRESHOLD;
  return pct >= threshold ? "Qualified" : "Not qualified";
}
