import { getAuthToken } from "@/lib/authToken";
import { L1_CYCLE } from "@/lib/l1AssessmentSchedule";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Whether the current student belongs to the fixed 12 July 2026 (Cycle 2)
 * assessment cohort. Source of truth is an uploaded list on the server.
 */
export async function fetchL1July12Registered(cycle = L1_CYCLE): Promise<boolean> {
  const res = await fetch(`/api/student/l1-july12-cohort?cycle=${cycle}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error("Could not load July 12 cohort status");
  }
  const data = (await res.json()) as { registered?: boolean };
  return Boolean(data.registered);
}
