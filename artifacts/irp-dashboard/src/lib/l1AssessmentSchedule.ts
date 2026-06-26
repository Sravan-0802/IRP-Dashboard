import { EXAM_DATE_LABEL } from "@/lib/irpDates";

/**
 * L1 Cycle 2 phase controls — flip these when the next assessment cycle opens.
 *
 * Current phase (post Cycle 2 online assessment):
 * - Online assessment is complete; ~14 FE-selected students moved to AI Mock Interview.
 * - Cleared-but-not-selected students see IRP 2.0 FE Project Main II on the dashboard.
 */
export const L1_CYCLE2_BANNER_VISIBLE = false;
export const L1_ASSESSMENT_CALENDAR_VISIBLE = false;

export const L1_HUSTLER_SLOTS = [
  { id: "slot-1", label: "3:00 PM – 5:00 PM IST" },
  { id: "slot-2", label: "6:00 PM – 8:00 PM IST" },
] as const;

export const L1_CYCLE = 2;

export const L1_HUSTLER_CALENDAR = {
  id: "l1-hustler",
  title: "L1 Hustler Assessment",
  subtitle: "Level 1 · The Hustler",
  cycleLabel: `Cycle ${L1_CYCLE}`,
  dateLabel: EXAM_DATE_LABEL,
  duration: "~2 hours",
  slots: L1_HUSTLER_SLOTS,
} as const;

export const L1_BANNER_TEXT =
  "We are conducting our IRP 2.0 Assessment for Level 1 – The Hustler (Cycle 2) on 5th July 2026. If you are interested and willing to appear, please confirm your availability by registering through the Assessments Calendar.";

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
export const L1_REGISTRATION_STORAGE_KEY = "irp-l1-cycle2-registration";

type StatusMap = Record<string, { status: string; slot?: string }>;

export function loadAssessmentStatuses(): StatusMap {
  try {
    return JSON.parse(localStorage.getItem(ASSESSMENT_STATUS_STORAGE_KEY) ?? "{}") as StatusMap;
  } catch {
    return {};
  }
}

export function loadL1Registration(): L1RegistrationRecord | null {
  try {
    const raw = localStorage.getItem(L1_REGISTRATION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as L1RegistrationRecord) : null;
  } catch {
    return null;
  }
}

export function saveL1Registration(record: L1RegistrationRecord): void {
  localStorage.setItem(L1_REGISTRATION_STORAGE_KEY, JSON.stringify(record));

  const map = loadAssessmentStatuses();
  if (record.availability === "yes" && record.slotId) {
    map[L1_HUSTLER_CALENDAR.id] = { ...map[L1_HUSTLER_CALENDAR.id], status: "todo", slot: record.slotId };
    localStorage.setItem(ASSESSMENT_STATUS_STORAGE_KEY, JSON.stringify(map));
  }
}

export function saveL1HustlerSlot(slotId: string): void {
  const map = loadAssessmentStatuses();
  map[L1_HUSTLER_CALENDAR.id] = { ...map[L1_HUSTLER_CALENDAR.id], status: "todo", slot: slotId };
  localStorage.setItem(ASSESSMENT_STATUS_STORAGE_KEY, JSON.stringify(map));
}

export function getL1HustlerSlot(): string | undefined {
  return loadAssessmentStatuses()[L1_HUSTLER_CALENDAR.id]?.slot;
}
