/** L1 Cycle 1 online assessment — completed 14 June 2026. */
export const L1_CYCLE1_EXAM_DATE = new Date("2026-06-14T00:00:00");
export const L1_CYCLE1_EXAM_DATE_LABEL = "14th June 2026";

/** L1 Cycle 2 online assessment — registration / upcoming. */
export const EXAM_DATE = new Date("2026-07-05T00:00:00");
export const EXAM_DATE_LABEL = "5th July 2026";
export const L1_CYCLE2_EXAM_DATE = EXAM_DATE;
export const L1_CYCLE2_EXAM_DATE_LABEL = EXAM_DATE_LABEL;

/** Assignment results unlock the day after the L1 assessment. */
export const RESULTS_UNLOCK_DATE = new Date("2026-07-06T00:00:00");

/**
 * Course-progress and practice stats are hidden until this date.
 * Edit this date when progress data goes live.
 */
export const PROGRESS_UNLOCK_DATE = new Date("2026-07-06T00:00:00");
export const PROGRESS_UNLOCK_LABEL = "Monday, 6 July";

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

/** True after the assessment day window has ended (from 15 June 2026 onward). */
export function isExamWindowClosed(now = new Date()): boolean {
  return now >= EXAM_DATE && !isAssessmentLive(now);
}
