import { getAuthToken } from "@/lib/authToken";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Returns whether the current user has completed payment. Fails open (treats
 * the user as paid) if the request errors, so a paying student is never blocked
 * by a transient failure.
 */
export async function fetchPaymentStatus(): Promise<boolean> {
  const res = await fetch(`/api/student/payment-status`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error("Could not load payment status");
  }
  const data = (await res.json()) as { paid: boolean };
  return data.paid !== false;
}
