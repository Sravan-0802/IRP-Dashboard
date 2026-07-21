import { getAuthToken } from "@/lib/authToken";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export type L1July26AllowlistStatus = {
  allowed: boolean;
};

export async function fetchL1July26AllowlistStatus(): Promise<L1July26AllowlistStatus> {
  const res = await fetch(`/api/student/l1-july26-allowlist`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error("Could not load July 26 allowlist status");
  }
  const data = (await res.json()) as { allowed?: boolean };
  return { allowed: Boolean(data.allowed) };
}
