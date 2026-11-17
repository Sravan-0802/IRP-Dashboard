import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/authToken";
import { parseTrackStatus, type MernTrackStatus } from "@/lib/trackStatus";

async function fetchTrackStatus(): Promise<MernTrackStatus | null> {
  const token = getAuthToken();
  const res = await fetch("/api/student/track-status", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) return null;
  return parseTrackStatus(await res.json());
}

/**
 * Stage results from the new tables, or null to keep the old logic (switch off, still loading, error,
 * or the server said the new tables are not usable right now). Never blocks the dashboard.
 */
export function useTrackStatus(userId: string): MernTrackStatus | null {
  const query = useQuery({
    queryKey: ["student", "track-status", userId],
    queryFn: fetchTrackStatus,
    enabled: Boolean(userId),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return query.data ?? null;
}
