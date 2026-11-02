export function isGenaiAssessmentLabel(value: string): boolean {
  return /(?:^|[^a-z0-9])(?:gen[\s_-]*ai|generative[\s_-]+ai)(?=$|[^a-z0-9])/i.test(value);
}

/** Legacy batches have no track field, so use their admin-entered assessment label/name. */
export function registrationBatchMatchesTrack(
  batch: { assessmentLabel: string; name: string | null },
  track: "mern" | "genai",
): boolean {
  const isGenai = isGenaiAssessmentLabel(`${batch.assessmentLabel} ${batch.name ?? ""}`);
  return isGenai === (track === "genai");
}

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
