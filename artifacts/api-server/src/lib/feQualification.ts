export type FeAssessmentStatus = "QUALIFIED" | "NOT QUALIFIED" | "NOT ATTEMPTED";

/** Mirrors the FE assessment_status CASE, without rounding before comparison. */
export function getFeAssessmentStatus(
  assessmentNumber: string | null | undefined,
  scorePercentage: number | null,
  userAssessmentStartDatetime: Date | string | null | undefined,
): FeAssessmentStatus {
  if (scorePercentage != null) {
    if (assessmentNumber === "A1" && scorePercentage >= 70) return "QUALIFIED";
    if (assessmentNumber === "A2" && scorePercentage === 100) return "QUALIFIED";
    // SQL NULL NOT IN (...) is unknown, not true.
    if (assessmentNumber != null && assessmentNumber !== "A1" &&
        assessmentNumber !== "A2" && scorePercentage >= 90) return "QUALIFIED";
  }
  return userAssessmentStartDatetime != null ? "NOT QUALIFIED" : "NOT ATTEMPTED";
}
