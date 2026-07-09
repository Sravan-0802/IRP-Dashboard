import type { AssessmentResult } from "@workspace/api-client-react";
import {
  L1_CYCLE1_EXAM_DATE,
  L1_CYCLE1_EXAM_DATE_LABEL,
  L1_JULY12_EXAM_DATE,
  L1_JULY12_EXAM_DATE_LABEL,
} from "@/lib/irpDates";
import { hasClearedAssessment, hasWrittenAssessment } from "@/lib/assessment";
import {
  L1_ASSESSMENT_CALENDAR_VISIBLE,
  L1_CYCLE2_BANNER_VISIBLE,
} from "@/lib/l1AssessmentSchedule";
import { isL1July12RegistrationOpen } from "@/lib/irpDates";

/**
 * L1 online assessment — two student tracks (do not mix):
 *
 * 1. cycle1_cleared — Cleared Cycle 1 on 14 June → FE Project / interview pipeline.
 * 2. cycle2_pending — Did not clear Cycle 1 → Cycle 2 assessment on 12 July.
 */
export type L1OnlineTrack = "cycle1_cleared" | "cycle2_pending";

export function getL1OnlineTrack(assessments: AssessmentResult[]): L1OnlineTrack {
  return hasClearedAssessment(assessments, 1) ? "cycle1_cleared" : "cycle2_pending";
}

export function isCycle1Cleared(assessments: AssessmentResult[]): boolean {
  return getL1OnlineTrack(assessments) === "cycle1_cleared";
}

export function isCycle2Candidate(assessments: AssessmentResult[]): boolean {
  return getL1OnlineTrack(assessments) === "cycle2_pending";
}

/** Cycle 1 completion date — only for cleared or attempted-not-cleared (their Cycle 1 sit). */
export function getL1Cycle1CompletedDateLabel(assessments: AssessmentResult[]): string | null {
  if (hasWrittenAssessment(assessments, 1)) return L1_CYCLE1_EXAM_DATE_LABEL;
  return null;
}

/** Upcoming / next assessment date for L1 hero countdown. */
export function getL1UpcomingExamDate(assessments: AssessmentResult[]): Date {
  return isCycle2Candidate(assessments) ? L1_JULY12_EXAM_DATE : L1_CYCLE1_EXAM_DATE;
}

/** Upcoming / next assessment date label for L1 hero, countdown, calendar. */
export function getL1UpcomingExamDateLabel(assessments: AssessmentResult[]): string {
  return isCycle2Candidate(assessments)
    ? L1_JULY12_EXAM_DATE_LABEL
    : L1_CYCLE1_EXAM_DATE_LABEL;
}

/** Cycle 2 banner — only for students who still need the 5 July assessment. */
export function shouldShowCycle2Banner(assessments: AssessmentResult[]): boolean {
  return L1_CYCLE2_BANNER_VISIBLE && isCycle2Candidate(assessments);
}

/** Cycle 2 calendar / slot registration — non-cohort students book the 12 July slot. */
export function shouldShowJuly12SlotCalendar(
  assessments: AssessmentResult[],
  july12CohortRegistered: boolean,
  hasSlotRegistration = false,
  registrationUnlocked = false,
): boolean {
  return (
    L1_ASSESSMENT_CALENDAR_VISIBLE &&
    isCycle2Candidate(assessments) &&
    !july12CohortRegistered &&
    (isL1July12RegistrationOpen() || registrationUnlocked || hasSlotRegistration)
  );
}

/** @deprecated Use shouldShowJuly12SlotCalendar for cycle-2 slot booking. */
export function shouldShowCycle2Calendar(assessments: AssessmentResult[]): boolean {
  return shouldShowJuly12SlotCalendar(assessments, false);
}

/** Calendar page stays visible for registered students after registration closes. */
export function shouldShowCycle2CalendarPage(
  assessments: AssessmentResult[],
  hasSlotRegistration: boolean,
  july12CohortRegistered = false,
  registrationUnlocked = false,
): boolean {
  return shouldShowJuly12SlotCalendar(
    assessments,
    july12CohortRegistered,
    hasSlotRegistration,
    registrationUnlocked,
  );
}
