import { EXAM_DATE_LABEL, L1_REGISTRATION_CLOSE_DATE_LABEL } from "@/lib/irpDates";

/**
 * L1 Cycle 2 UI flags — banner & calendar apply only to cycle2_pending students
 * (see l1StudentTrack.ts). Cleared Cycle 1 students never see Cycle 2 registration.
 */
export const L1_CYCLE2_BANNER_VISIBLE = true;
export const L1_ASSESSMENT_CALENDAR_VISIBLE = false;

export const L1_HUSTLER_SLOTS = [
  { id: "slot-1", label: "3:00 PM – 5:00 PM IST" },
  { id: "slot-2", label: "6:00 PM – 8:00 PM IST" },
] as const;

/** Single slot for the 12 July re-conduction (non-cohort students). */
export const L1_JULY12_HUSTLER_SLOTS = [
  { id: "slot-2", label: "6:00 PM – 8:00 PM IST" },
] as const;

export const L1_JULY12_CONFIRMED_SLOT_LABEL = L1_JULY12_HUSTLER_SLOTS[0].label;

export const L1_CYCLE = 2;

/**
 * Exam-platform (topin.tech) assessment links for the 5th July L1 Hustler exam.
 * The mock link is COMMON to every student; the MAIN link is slot-specific and
 * is only revealed on exam day (see isAssessmentLive). Slot assignment comes
 * from the authoritative exam-platform list (l1_exam_access), not registration.
 */
/** 12 July 2026 mock link — common to all registered students. */
export const L1_MOCK_ASSESSMENT_URL =
  "https://assessment.topin.tech/assessment?org_id=248f8108-2922-46cb-9fd7-af5edd025a9a&auto_redirect=1";

/** 12 July 2026 main assessment link — single link for all registered students. */
export const L1_JULY12_MAIN_URL =
  "https://assessment.topin.tech/assessment?org_id=52070b14-d6b1-415d-8720-65e8b2aefec0&auto_redirect=1";

export const L1_HUSTLER_MAIN_URLS: Record<string, string> = {
  "slot-1": L1_JULY12_MAIN_URL,
  "slot-2": L1_JULY12_MAIN_URL,
};

export function l1HustlerSlotLabel(slotId: string | null | undefined): string | undefined {
  return (
    L1_JULY12_HUSTLER_SLOTS.find((s) => s.id === slotId)?.label ??
    L1_HUSTLER_SLOTS.find((s) => s.id === slotId)?.label
  );
}

export const L1_HUSTLER_CALENDAR = {
  id: "l1-hustler",
  title: "L1 Hustler Assessment",
  subtitle: "Level 1 · The Hustler",
  cycleLabel: `Cycle ${L1_CYCLE}`,
  dateLabel: EXAM_DATE_LABEL,
  duration: "~2 hours",
  slots: L1_HUSTLER_SLOTS,
} as const;

export const L1_JULY12_HUSTLER_CALENDAR = {
  id: "l1-hustler",
  title: "L1 Hustler Assessment",
  subtitle: "Level 1 · The Hustler",
  cycleLabel: `Cycle ${L1_CYCLE}`,
  dateLabel: "12th July 2026",
  duration: "~2 hours",
  slots: L1_JULY12_HUSTLER_SLOTS,
} as const;

export const L1_REGISTRATION_BANNER_EYEBROW = "Level 1 · The Hustler";
export const L1_REGISTRATION_BANNER_TITLE = "IRP 2.0 Assessment — 5th July 2026";
export const L1_BANNER_TEXT =
  `We are conducting our IRP 2.0 Assessment for Level 1 – The Hustler on 5th July 2026. If you are interested and willing to appear, please confirm your availability by registering through the Assessments Calendar. Registration closes on ${L1_REGISTRATION_CLOSE_DATE_LABEL}.`;

export const L1_REGISTRATION_CLOSED_BANNER_TITLE = "Registration closed";
export const L1_REGISTRATION_CLOSED_BANNER_TEXT =
  `Registrations for the 5th July L1 Hustler Assessment are now closed as of ${L1_REGISTRATION_CLOSE_DATE_LABEL}.`;

export const L1_JULY12_REGISTRATION_BANNER_TITLE = "IRP 2.0 Assessment — 12th July 2026";
export const L1_JULY12_BANNER_TEXT =
  "We are conducting our IRP 2.0 Assessment for Level 1 – The Hustler on 12th July 2026. If you are interested and willing to appear, please confirm your availability by registering through the Assessment Calendar.";
export const L1_JULY12_REGISTRATION_OPENS_BANNER_TITLE = "Registration opens tonight";
export const L1_JULY12_REGISTRATION_OPENS_BANNER_TEXT =
  "Slot registration for the 12th July L1 Hustler Assessment opens at 9:00 PM IST today (7th July 2026). Please return then to book your 6:00 PM – 8:00 PM IST slot.";
export const L1_JULY12_REGISTRATION_CLOSED_BANNER_TEXT =
  "Registrations for the 12th July L1 Hustler Assessment are now closed.";

/** Confirmation shown to the fixed 12 July (Cycle 2) assessment cohort. */
export const L1_JULY12_REGISTERED_BANNER_EYEBROW = "Level 1 · The Hustler";
export const L1_JULY12_REGISTERED_BANNER_TITLE =
  "Already registered for the 12th July 2026 assessment";
export const L1_JULY12_REGISTERED_BANNER_TEXT =
  "You registered for the 5th July L1 Hustler assessment. Due to technical issues, the assessment is being conducted again on 12th July 2026. Your 6:00 PM – 8:00 PM IST slot is already booked — no further action is needed. Your assessment details will appear here closer to the exam.";
export const L1_JULY12_REGISTERED_HUB_NOTE =
  "Already registered for 12th July 2026. Your 6:00 PM – 8:00 PM IST slot is booked.";
export const L1_JULY12_REGISTERED_CALENDAR_TITLE = "Already registered for 12th July 2026";
export const L1_JULY12_REGISTERED_CALENDAR_DESCRIPTION =
  "Your assessment registration is confirmed. The 6:00 PM – 8:00 PM IST slot on 12th July 2026 is already booked for you.";

export function hasSuccessfulSlotRegistration(
  record: L1RegistrationRecord | null | undefined,
): boolean {
  return record?.availability === "yes" && Boolean(record.slotId);
}

export const AVAILABILITY_OPTIONS = [
  { value: "yes", label: "Yes, I can attend" },
  { value: "no-not-prepared", label: "No, I am not prepared yet" },
  { value: "no-conflict", label: "No, I have a scheduling conflict" },
] as const;

export type AvailabilityValue = (typeof AVAILABILITY_OPTIONS)[number]["value"];

export interface L1RegistrationRecord {
  availability: AvailabilityValue;
  understandsGc?: boolean;
  willAttend?: boolean;
  unavailabilityReason?: string;
  notifyNextCycle?: boolean;
  slotId?: string;
  submittedAt: string;
}

export const ASSESSMENT_STATUS_STORAGE_KEY = "irp-assessment-status";

type StatusMap = Record<string, { status: string; slot?: string }>;

export function loadAssessmentStatuses(): StatusMap {
  try {
    return JSON.parse(localStorage.getItem(ASSESSMENT_STATUS_STORAGE_KEY) ?? "{}") as StatusMap;
  } catch {
    return {};
  }
}

/** @deprecated Registration is stored in Postgres (l1_cycle_registrations). */
export function loadL1Registration(): L1RegistrationRecord | null {
  return null;
}

/** Syncs assessment card UI slot after a successful API registration. */
export function syncL1HustlerSlotFromRegistration(record: L1RegistrationRecord): void {
  if (record.availability !== "yes" || !record.slotId) return;
  const map = loadAssessmentStatuses();
  map[L1_HUSTLER_CALENDAR.id] = { ...map[L1_HUSTLER_CALENDAR.id], status: "todo", slot: record.slotId };
  localStorage.setItem(ASSESSMENT_STATUS_STORAGE_KEY, JSON.stringify(map));
}

export function saveL1HustlerSlot(slotId: string): void {
  const map = loadAssessmentStatuses();
  map[L1_HUSTLER_CALENDAR.id] = { ...map[L1_HUSTLER_CALENDAR.id], status: "todo", slot: slotId };
  localStorage.setItem(ASSESSMENT_STATUS_STORAGE_KEY, JSON.stringify(map));
}

export function getL1HustlerSlot(): string | undefined {
  return loadAssessmentStatuses()[L1_HUSTLER_CALENDAR.id]?.slot;
}

/** Clears legacy browser keys (dev). Registration lives in l1_cycle_registrations. */
export function clearL1RegistrationLocal(): void {
  localStorage.removeItem("irp-l1-cycle2-registration");
  const map = loadAssessmentStatuses();
  delete map[L1_HUSTLER_CALENDAR.id];
  localStorage.setItem(ASSESSMENT_STATUS_STORAGE_KEY, JSON.stringify(map));
}

/** Dev helper: ?resetL1Registration=1 clears API + legacy local keys, then reloads. */
export async function maybeResetL1RegistrationFromUrl(): Promise<boolean> {
  if (import.meta.env.PROD) return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("resetL1Registration") !== "1") return false;
  const { deleteL1RegistrationDev } = await import("@/lib/l1RegistrationApi");
  await deleteL1RegistrationDev().catch(() => undefined);
  clearL1RegistrationLocal();
  url.searchParams.delete("resetL1Registration");
  const next = url.pathname + (url.search || "") + url.hash;
  window.history.replaceState({}, "", next);
  return true;
}
