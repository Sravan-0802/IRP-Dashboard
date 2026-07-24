import type { AssessmentResult } from "@workspace/api-client-react";
import {
  L1_CYCLE1_EXAM_DATE,
  L1_CYCLE1_EXAM_DATE_LABEL,
  L1_JULY26_EXAM_DATE,
  L1_JULY26_EXAM_DATE_LABEL,
  isL1July12RegistrationOpen,
  isL1July26RegistrationOpen,
} from "@/lib/irpDates";
import { hasClearedAssessment, hasWrittenAssessment } from "@/lib/assessment";
import {
  L1_ASSESSMENT_CALENDAR_VISIBLE,
  L1_CYCLE2_BANNER_VISIBLE,
} from "@/lib/l1AssessmentSchedule";
import { isJuly26BookingTestUser } from "@/lib/july26BookingTestUsers";

/**
 * L1 online assessment — two student tracks (do not mix):
 *
 * 1. cycle1_cleared — Cleared Cycle 1 on 14 June → FE Project / interview pipeline.
 * 2. cycle2_pending — Did not clear Cycle 1 → Cycle 2 / July 26 booking track.
 *
 * Booking test users are forced onto cycle2_pending so they stay on Online Assessment
 * with July 26 slot booking, even if synced L1 scores already look cleared.
 */
export type L1OnlineTrack = "cycle1_cleared" | "cycle2_pending";

export function getL1OnlineTrack(
  assessments: AssessmentResult[],
  userId?: string | null,
): L1OnlineTrack {
  if (isJuly26BookingTestUser(userId)) return "cycle2_pending";
  return hasClearedAssessment(assessments, 1) ? "cycle1_cleared" : "cycle2_pending";
}

export function isCycle1Cleared(
  assessments: AssessmentResult[],
  userId?: string | null,
): boolean {
  return getL1OnlineTrack(assessments, userId) === "cycle1_cleared";
}

export function isCycle2Candidate(
  assessments: AssessmentResult[],
  userId?: string | null,
): boolean {
  return getL1OnlineTrack(assessments, userId) === "cycle2_pending";
}

/** Cycle 1 completion date — only for cleared or attempted-not-cleared (their Cycle 1 sit). */
export function getL1Cycle1CompletedDateLabel(assessments: AssessmentResult[]): string | null {
  if (hasWrittenAssessment(assessments, 1)) return L1_CYCLE1_EXAM_DATE_LABEL;
  return null;
}

/** Upcoming / next assessment date for L1 hero countdown. */
export function getL1UpcomingExamDate(
  assessments: AssessmentResult[],
  userId?: string | null,
): Date {
  return isCycle2Candidate(assessments, userId) ? L1_JULY26_EXAM_DATE : L1_CYCLE1_EXAM_DATE;
}

/** Upcoming / next assessment date label for L1 hero, countdown, calendar. */
export function getL1UpcomingExamDateLabel(
  assessments: AssessmentResult[],
  userId?: string | null,
): string {
  return isCycle2Candidate(assessments, userId)
    ? L1_JULY26_EXAM_DATE_LABEL
    : L1_CYCLE1_EXAM_DATE_LABEL;
}

/** Cycle 2 banner — only for students who still need the next assessment. */
export function shouldShowCycle2Banner(
  assessments: AssessmentResult[],
  userId?: string | null,
): boolean {
  return L1_CYCLE2_BANNER_VISIBLE && isCycle2Candidate(assessments, userId);
}

/** Cycle 2 calendar / slot registration — non-cohort students book the 12 July slot. */
export function shouldShowJuly12SlotCalendar(
  assessments: AssessmentResult[],
  july12CohortRegistered: boolean,
  hasSlotRegistration = false,
  registrationUnlocked = false,
  userId?: string | null,
): boolean {
  return (
    L1_ASSESSMENT_CALENDAR_VISIBLE &&
    isCycle2Candidate(assessments, userId) &&
    !july12CohortRegistered &&
    (isL1July12RegistrationOpen() || registrationUnlocked || hasSlotRegistration)
  );
}

/** @deprecated Use shouldShowJuly12SlotCalendar for cycle-2 slot booking. */
export function shouldShowCycle2Calendar(assessments: AssessmentResult[]): boolean {
  return shouldShowJuly12SlotCalendar(assessments, false);
}

/** July 26 (Cycle 3) slot registration — only shown to students in the allowlist. */
export function shouldShowJuly26SlotCalendar(
  assessments: AssessmentResult[],
  inAllowlist: boolean,
  hasSlotRegistration = false,
  userId?: string | null,
): boolean {
  if (!L1_ASSESSMENT_CALENDAR_VISIBLE || !inAllowlist) return false;
  if (isJuly26BookingTestUser(userId)) return true;
  return (
    isCycle2Candidate(assessments, userId) &&
    (isL1July26RegistrationOpen() || hasSlotRegistration)
  );
}

/** Calendar page stays visible for registered students after registration closes. */
export function shouldShowCycle2CalendarPage(
  assessments: AssessmentResult[],
  hasSlotRegistration: boolean,
  july12CohortRegistered = false,
  registrationUnlocked = false,
  userId?: string | null,
): boolean {
  return shouldShowJuly12SlotCalendar(
    assessments,
    july12CohortRegistered,
    hasSlotRegistration,
    registrationUnlocked,
    userId,
  );
}
