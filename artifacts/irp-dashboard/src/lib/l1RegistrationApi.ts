import { getAuthToken } from "@/lib/authToken";
import type { AvailabilityValue, L1RegistrationRecord } from "@/lib/l1AssessmentSchedule";
import { L1_CYCLE } from "@/lib/l1AssessmentSchedule";

export type L1RegistrationApi = {
  id: number;
  academyUserId: string;
  userName?: string | null;
  cycle: number;
  level: number;
  assessmentDate: string;
  availability: string;
  slotId?: string;
  slotLabel?: string;
  understandsGc?: boolean;
  willAttend?: boolean;
  unavailabilityReason?: string;
  notifyNextCycle?: boolean;
  submittedAt: string;
};

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export function apiToL1RegistrationRecord(reg: L1RegistrationApi): L1RegistrationRecord {
  return {
    availability: reg.availability as AvailabilityValue,
    understandsGc: reg.understandsGc,
    willAttend: reg.willAttend,
    unavailabilityReason: reg.unavailabilityReason,
    notifyNextCycle: reg.notifyNextCycle,
    slotId: reg.slotId,
    submittedAt: reg.submittedAt,
  };
}

async function parseApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    if (res.status === 404) {
      return "Registration service unavailable. Restart the API server (port 8080) and try again.";
    }
    if (text.includes("<!DOCTYPE")) {
      return fallback;
    }
  }
  return fallback;
}

export async function fetchL1Registration(cycle = L1_CYCLE): Promise<L1RegistrationRecord | null> {
  const res = await fetch(`/api/student/l1-registration?cycle=${cycle}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Could not load registration"));
  }
  const data = (await res.json()) as { registration: L1RegistrationApi | null };
  return data.registration ? apiToL1RegistrationRecord(data.registration) : null;
}

export async function submitL1Registration(
  record: L1RegistrationRecord,
  cycle = L1_CYCLE,
): Promise<L1RegistrationRecord> {
  const res = await fetch("/api/student/l1-registration", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      cycle,
      availability: record.availability,
      slotId: record.slotId,
      understandsGc: record.understandsGc,
      willAttend: record.willAttend,
      unavailabilityReason: record.unavailabilityReason,
      notifyNextCycle: record.notifyNextCycle,
    }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Registration failed"));
  }
  const data = (await res.json()) as { registration: L1RegistrationApi };
  return apiToL1RegistrationRecord(data.registration);
}

export async function deleteL1RegistrationDev(cycle = L1_CYCLE): Promise<void> {
  await fetch(`/api/student/l1-registration?cycle=${cycle}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}
