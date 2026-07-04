import { getAuthToken } from "@/lib/authToken";
import { L1_CYCLE } from "@/lib/l1AssessmentSchedule";

export type L1ExamAccess = {
  slotId: string;
};

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchL1ExamAccess(cycle = L1_CYCLE): Promise<L1ExamAccess | null> {
  const res = await fetch(`/api/student/l1-exam-access?cycle=${cycle}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error("Could not load exam access");
  }
  const data = (await res.json()) as { examAccess: L1ExamAccess | null };
  return data.examAccess ?? null;
}
