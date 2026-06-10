export const EXAM_DATE = new Date("2026-06-14T00:00:00");
export const EXAM_DATE_LABEL = "14 June 2026";

/** Assignment results unlock the day after the L1 assessment. */
export const RESULTS_UNLOCK_DATE = new Date("2026-06-15T00:00:00");

export function areAssignmentResultsVisible(now = new Date()): boolean {
  return now >= RESULTS_UNLOCK_DATE;
}
