import { getAuthToken } from "@/lib/authToken";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Returns the dashboard access decision derived from IRP, LP, and product
 * statuses. Payment status is not used to decide access.
 */
export type DashboardAccessStatus = {
  allowed: boolean;
  irpEligibleStatus: string | null;
  lpStatus: string | null;
  productStatus: string | null;
};

export async function fetchDashboardAccess(): Promise<DashboardAccessStatus> {
  const res = await fetch(`/api/student/payment-status`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error("Could not verify dashboard access");
  }
  return (await res.json()) as DashboardAccessStatus;
}
