/** L1 Cycle 1 online assessment — completed 14 June 2026. */
export const L1_CYCLE1_EXAM_DATE = new Date("2026-06-14T00:00:00");
export const L1_CYCLE1_EXAM_DATE_LABEL = "14th June 2026";

/** L1 Cycle 2 online assessment — registration / upcoming. */
export const EXAM_DATE = new Date("2026-07-05T00:00:00");
export const EXAM_DATE_LABEL = "5th July 2026";
export const L1_CYCLE2_EXAM_DATE = EXAM_DATE;
export const L1_CYCLE2_EXAM_DATE_LABEL = EXAM_DATE_LABEL;

/** L1 Cycle 2 re-conduction — upcoming sit for cycle2_pending students. */
export const L1_JULY12_EXAM_DATE = new Date("2026-07-12T00:00:00+05:30");
export const L1_JULY12_EXAM_DATE_LABEL = "12th July 2026";

/** July 12 results unlock the day after the assessment. */
export const L1_JULY12_RESULTS_UNLOCK_DATE = new Date("2026-07-13T00:00:00+05:30");

/** Slot registration for the 12 July re-conduction opens 7 July 2026, 9:00 PM IST. */
export const L1_JULY12_REGISTRATION_OPEN_DATE = new Date("2026-07-07T21:00:00+05:30");
export const L1_JULY12_REGISTRATION_OPEN_DATE_LABEL = "7th July 2026, 9:00 PM IST";

/** Slot registration for the 12 July re-conduction closes 30 minutes before the slot. */
export const L1_JULY12_REGISTRATION_CLOSE_DATE = new Date("2026-07-12T17:30:00+05:30");
export const L1_JULY12_REGISTRATION_CLOSE_DATE_LABEL = "12th July 2026, 5:30 PM IST";

function isJuly12RegistrationForceOpen(): boolean {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_L1_JULY12_REGISTRATION_FORCE_OPEN === "1"
  );
}

export function hasL1July12RegistrationStarted(now = new Date()): boolean {
  return isJuly12RegistrationForceOpen() || now.getTime() >= L1_JULY12_REGISTRATION_OPEN_DATE.getTime();
}

export function isL1July12RegistrationOpen(now = new Date()): boolean {
  return (
    hasL1July12RegistrationStarted(now) &&
    now.getTime() < L1_JULY12_REGISTRATION_CLOSE_DATE.getTime()
  );
}

/** Slot registration closed at 6:00 PM IST on 3 July 2026. */
export const L1_REGISTRATION_CLOSE_DATE = new Date("2026-07-03T18:00:00+05:30");
export const L1_REGISTRATION_CLOSE_DATE_LABEL = "3rd July 2026, 6:00 PM IST";

export function isL1RegistrationOpen(now = new Date()): boolean {
  return now.getTime() < L1_REGISTRATION_CLOSE_DATE.getTime();
}

/** Assignment results unlock the day after the L1 Cycle 2 assessment (5 July). */
export const RESULTS_UNLOCK_DATE = new Date("2026-07-06T00:00:00");

/** L1 scores for the 5 July Cycle 2 sit go live on 10 July. */
export const L1_CYCLE2_RESULTS_UNLOCK_DATE = new Date("2026-07-10T00:00:00+05:30");
export const L1_CYCLE2_RESULTS_UNLOCK_LABEL = "10th July 2026";

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

export function areL1Cycle2ResultsVisible(now = new Date()): boolean {
  return now >= L1_CYCLE2_RESULTS_UNLOCK_DATE;
}

/** Progress data (MCQs, coding, course stats) is visible only on/after PROGRESS_UNLOCK_DATE. */
export function isProgressVisible(now = new Date()): boolean {
  return now >= PROGRESS_UNLOCK_DATE;
}

/** True after the assessment day window has ended (from 15 June 2026 onward). */
export function isExamWindowClosed(now = new Date()): boolean {
  return now >= EXAM_DATE && !isAssessmentLive(now);
}

/** July 12 re-conduction — live only on assessment day until results unlock. */
export function isL1July12AssessmentLive(now = new Date()): boolean {
  return now >= L1_JULY12_EXAM_DATE && now < L1_JULY12_RESULTS_UNLOCK_DATE;
}

export function isL1July12ExamWindowClosed(now = new Date()): boolean {
  return now >= L1_JULY12_EXAM_DATE && !isL1July12AssessmentLive(now);
}
