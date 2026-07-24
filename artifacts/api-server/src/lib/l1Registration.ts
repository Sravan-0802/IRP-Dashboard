import { isInL1July12RegistrationUnlock } from "./l1July12RegistrationUnlock";
import { isJuly26BookingTestUser } from "./july26BookingTestUsers";
import { isInL1July26Allowlist } from "./l1July26Allowlist";

export const L1_REGISTRATION_CYCLE = 3;
export const L1_REGISTRATION_LEVEL = 1;

/** Cycle 2 — 12 July 2026 (closed). */
export const L1_REGISTRATION_ASSESSMENT_DATE = "5th July 2026";
export const L1_JULY12_REGISTRATION_ASSESSMENT_DATE = "12th July 2026";
export const L1_REGISTRATION_CLOSE_DATE = new Date("2026-07-03T23:59:59+05:30");
export const L1_JULY12_REGISTRATION_CLOSE_DATE = new Date("2026-07-12T17:30:00+05:30");
export const L1_JULY12_REGISTRATION_OPEN_DATE = new Date("2026-07-07T21:00:00+05:30");

/** Cycle 3 — 26 July 2026 (current). */
export const L1_JULY26_REGISTRATION_ASSESSMENT_DATE = "26th July 2026";
export const L1_JULY26_REGISTRATION_OPEN_DATE = new Date("2026-07-21T00:00:00+05:30");
export const L1_JULY26_REGISTRATION_CLOSE_DATE = new Date("2026-07-26T17:30:00+05:30");

export function hasL1July12RegistrationStarted(now = new Date()): boolean {
  return now.getTime() >= L1_JULY12_REGISTRATION_OPEN_DATE.getTime();
}

export function isL1RegistrationOpen(now = new Date()): boolean {
  return now.getTime() <= L1_REGISTRATION_CLOSE_DATE.getTime();
}

export function isL1July12RegistrationOpen(now = new Date()): boolean {
  return (
    hasL1July12RegistrationStarted(now) &&
    now.getTime() < L1_JULY12_REGISTRATION_CLOSE_DATE.getTime()
  );
}

export function canRegisterForL1July12(
  userId: string | null | undefined,
  now = new Date(),
): boolean {
  if (now.getTime() >= L1_JULY12_REGISTRATION_CLOSE_DATE.getTime()) return false;
  if (isInL1July12RegistrationUnlock(userId)) return true;
  return isL1July12RegistrationOpen(now);
}

export function isL1July26RegistrationOpen(now = new Date()): boolean {
  return (
    now.getTime() >= L1_JULY26_REGISTRATION_OPEN_DATE.getTime() &&
    now.getTime() < L1_JULY26_REGISTRATION_CLOSE_DATE.getTime()
  );
}

export function canRegisterForL1July26(
  userId?: string | null,
  now = new Date(),
): boolean {
  if (isJuly26BookingTestUser(userId) && isInL1July26Allowlist(userId ?? "")) {
    return true;
  }
  return isL1July26RegistrationOpen(now);
}

export const L1_SLOT_LABELS: Record<string, string> = {
  "slot-1": "6:00 PM – 8:00 PM IST",
  "slot-2": "6:00 PM – 8:00 PM IST",
  "slot-3": "6:00 PM – 8:00 PM IST",
};

export const L1_JULY12_SLOT_IDS = new Set(["slot-2"]);
export const L1_JULY26_SLOT_IDS = new Set(["slot-3"]);

export const L1_AVAILABILITY_VALUES = new Set([
  "yes",
  "no-not-prepared",
  "no-conflict",
]);

export type L1Availability = "yes" | "no-not-prepared" | "no-conflict";

export interface L1RegistrationPayload {
  cycle?: number;
  availability: string;
  slotId?: string;
  understandsGc?: boolean;
  willAttend?: boolean;
  unavailabilityReason?: string;
  notifyNextCycle?: boolean;
}

export function slotLabelFor(slotId: string | undefined): string | null {
  if (!slotId) return null;
  return L1_SLOT_LABELS[slotId] ?? null;
}

export function parseRegistrationCycle(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : L1_REGISTRATION_CYCLE;
}

export function validateL1RegistrationPayload(body: L1RegistrationPayload): string | null {
  const cycle = body.cycle ?? L1_REGISTRATION_CYCLE;
  if (!Number.isInteger(cycle) || cycle < 1) {
    return "Invalid cycle";
  }

  const availability = typeof body.availability === "string" ? body.availability.trim() : "";
  if (!L1_AVAILABILITY_VALUES.has(availability)) {
    return "Invalid availability";
  }

  const isYes = availability === "yes";
  const isNo = availability.startsWith("no-");

  if (isYes) {
    const slotId = typeof body.slotId === "string" ? body.slotId.trim() : "";
    if (!slotId || !L1_SLOT_LABELS[slotId]) {
      return "A valid slot is required";
    }
    if (body.understandsGc !== true || body.willAttend !== true) {
      return "Please confirm both checkboxes to complete registration";
    }
  }

  if (isNo) {
    const reason =
      typeof body.unavailabilityReason === "string" ? body.unavailabilityReason.trim() : "";
    if (!reason || reason.length > 2000) {
      return "Please provide a reason for unavailability (max 2000 characters)";
    }
  }

  return null;
}

export function rowToL1RegistrationResponse(row: {
  id: number;
  academyUserId: string;
  userName: string | null;
  cycle: number;
  level: number;
  assessmentDate: string;
  availability: string;
  slotId: string | null;
  slotLabel: string | null;
  understandsGc: number | null;
  willAttend: number | null;
  unavailabilityReason: string | null;
  notifyNextCycle: number | null;
  submittedAt: Date;
}) {
  return {
    id: row.id,
    academyUserId: row.academyUserId,
    userName: row.userName,
    cycle: row.cycle,
    level: row.level,
    assessmentDate: row.assessmentDate,
    availability: row.availability,
    slotId: row.slotId ?? undefined,
    slotLabel: row.slotLabel ?? undefined,
    understandsGc: row.understandsGc === 1 ? true : undefined,
    willAttend: row.willAttend === 1 ? true : undefined,
    unavailabilityReason: row.unavailabilityReason ?? undefined,
    notifyNextCycle: row.notifyNextCycle === 1 ? true : undefined,
    submittedAt: row.submittedAt.toISOString(),
  };
}
