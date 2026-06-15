export const EXAM_DATE = new Date("2026-06-14T00:00:00");
export const EXAM_DATE_LABEL = "14 June 2026";

/** Assignment results unlock the day after the L1 assessment. */
export const RESULTS_UNLOCK_DATE = new Date("2026-06-15T00:00:00");

/**
 * Course-progress and practice stats are hidden until this date.
 * Edit this date when progress data goes live.
 */
export const PROGRESS_UNLOCK_DATE = new Date("2026-06-15T00:00:00");
export const PROGRESS_UNLOCK_LABEL = "Monday, 15 June";

/**
 * The assessment is only "live" on the assessment day itself (from the exam
 * date until results unlock the next day). Any "live now / window closes"
 * messaging must be gated on this — never show it before the assessment date,
 * since the journey state alone is not date-aware.
 */
export function isAssessmentLive(now = new Date()): boolean {
  return now >= EXAM_DATE && now < RESULTS_UNLOCK_DATE;
}

export function areAssignmentResultsVisible(now = new Date()): boolean {
  return now >= RESULTS_UNLOCK_DATE;
}

/** Progress data (MCQs, coding, course stats) is visible only on/after PROGRESS_UNLOCK_DATE. */
export function isProgressVisible(now = new Date()): boolean {
  return now >= PROGRESS_UNLOCK_DATE;
}
