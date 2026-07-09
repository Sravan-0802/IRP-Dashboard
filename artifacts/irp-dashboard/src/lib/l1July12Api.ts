import { getAuthToken } from "@/lib/authToken";
import { L1_CYCLE } from "@/lib/l1AssessmentSchedule";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export type L1July12CohortStatus = {
  registered: boolean;
  registrationUnlocked: boolean;
};

/**
 * Whether the current student belongs to the fixed 12 July 2026 (Cycle 2)
 * assessment cohort, and whether they are on the early-registration unlock list.
 */
export async function fetchL1July12CohortStatus(cycle = L1_CYCLE): Promise<L1July12CohortStatus> {
  const res = await fetch(`/api/student/l1-july12-cohort?cycle=${cycle}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error("Could not load July 12 cohort status");
  }
  const data = (await res.json()) as { registered?: boolean; registrationUnlocked?: boolean };
  return {
    registered: Boolean(data.registered),
    registrationUnlocked: Boolean(data.registrationUnlocked),
  };
}

/** @deprecated Use fetchL1July12CohortStatus */
export async function fetchL1July12Registered(cycle = L1_CYCLE): Promise<boolean> {
  const status = await fetchL1July12CohortStatus(cycle);
  return status.registered;
}
