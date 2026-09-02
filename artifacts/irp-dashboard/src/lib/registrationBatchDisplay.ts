/** Strip typo/Excel artifacts from admin-entered assessment dates. */
export function formatAssessmentDateLabel(value: string): string {
  return value.replace(/\^th/gi, "").replace(/\s+/g, " ").trim();
}

/** Hide the date row when the title already includes the same date text. */
export function shouldShowAssessmentDateMeta(assessmentLabel: string, assessmentDate: string): boolean {
  const formatted = formatAssessmentDateLabel(assessmentDate);
  if (!formatted) return false;
  return !assessmentLabel.toLowerCase().includes(formatted.toLowerCase());
}

function dateFromAssessmentLabel(assessmentLabel: string): string | null {
  const match = assessmentLabel.match(/[-–]\s*(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})\s*$/i);
  return match?.[1]?.trim() ?? null;
}

export function resolveRegistrationBatchDate(
  assessmentLabel: string,
  assessmentDate: string,
): { dateLabel: string; showDateMeta: boolean } {
  const formatted = formatAssessmentDateLabel(assessmentDate);
  const showDateMeta = shouldShowAssessmentDateMeta(assessmentLabel, assessmentDate);
  const dateLabel = showDateMeta ? formatted : (dateFromAssessmentLabel(assessmentLabel) ?? formatted);
  return { dateLabel, showDateMeta };
}
