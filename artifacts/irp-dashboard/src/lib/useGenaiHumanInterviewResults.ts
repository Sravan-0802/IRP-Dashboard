import {
  useGetGenaiHumanInterviewResults,
  getGetGenaiHumanInterviewResultsQueryKey,
  type GenaiHumanInterviewAttempt,
  type GenaiHumanInterviewResults,
} from "@workspace/api-client-react";
import { getAuthToken } from "@/lib/authToken";

/** Shared GenAI interview results for the journey stage card and the results section. */
export function useGenaiHumanInterviewResults(enabled = true) {
  const token = getAuthToken();
  return useGetGenaiHumanInterviewResults({
    query: {
      queryKey: [...getGetGenaiHumanInterviewResultsQueryKey(), token ?? ""],
      enabled,
      staleTime: 60_000,
      refetchInterval: 120_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    request: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

/** Released latest scored outcome, or null while unreleased / not yet scored. */
export function genaiInterviewOutcome(
  results: GenaiHumanInterviewResults | undefined,
): { cleared: boolean; latest: GenaiHumanInterviewAttempt } | null {
  const latest = results?.released ? results.latestResult : null;
  if (!latest || latest.finalScore === null ||
      !["Cleared", "Not Cleared"].includes(latest.clearanceStatus)) return null;
  return { cleared: latest.clearanceStatus === "Cleared", latest };
}
