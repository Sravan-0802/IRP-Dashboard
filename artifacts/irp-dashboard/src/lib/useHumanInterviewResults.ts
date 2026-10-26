import {
  useGetHumanInterviewResults,
  getGetHumanInterviewResultsQueryKey,
} from "@workspace/api-client-react";
import { getAuthToken } from "@/lib/authToken";

/** Shared, identity-scoped results for the score history and existing clear card. */
export function useHumanInterviewResults(userId: string, enabled = true) {
  const token = getAuthToken();
  return useGetHumanInterviewResults({
    query: {
      queryKey: [...getGetHumanInterviewResultsQueryKey(), userId],
      enabled: enabled && Boolean(userId),
      staleTime: 60_000,
      refetchInterval: 120_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    request: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}
