import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/authToken";

export type ActiveRegistrationBatch = {
  id: number;
  name: string | null;
  assessmentLabel: string;
  assessmentDate: string;
  slotId: string | null;
  slotLabel: string | null;
  startsAt: string | null;
  expiresAt: string | null;
};

export type RegistrationBatchState = {
  batch: ActiveRegistrationBatch | null;
  hasResponded: boolean;
};

const REG_BATCH_KEY = ["student", "registration-batch"] as const;

async function fetchRegistrationBatch(): Promise<RegistrationBatchState> {
  const token = getAuthToken();
  const res = await fetch("/api/student/registration-batch", {
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error("Could not load registration batch");
  return res.json() as Promise<RegistrationBatchState>;
}

export function useRegistrationBatch() {
  const query = useQuery({
    queryKey: REG_BATCH_KEY,
    queryFn: fetchRegistrationBatch,
    staleTime: 60_000,
    retry: 1,
  });
  return {
    batch: query.data?.batch ?? null,
    hasResponded: query.data?.hasResponded ?? false,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
