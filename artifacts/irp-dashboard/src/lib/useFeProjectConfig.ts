import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/authToken";
import { FE_PROJECT_CLEAR_MIN_SCORE } from "@/lib/feProjectConfig";

export type FeProjectConfig = {
  minScore: number | null;
};

const FE_PROJECT_CONFIG_KEY = ["student", "fe-project-config"] as const;

async function fetchFeProjectConfig(): Promise<FeProjectConfig> {
  const token = getAuthToken();
  const res = await fetch("/api/student/fe-project-config", {
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error("Could not load fe project config");
  return res.json() as Promise<FeProjectConfig>;
}

export function useFeProjectConfig() {
  const query = useQuery({
    queryKey: FE_PROJECT_CONFIG_KEY,
    queryFn: fetchFeProjectConfig,
    staleTime: 60_000,
    retry: 1,
  });
  return {
    minScore: query.data?.minScore ?? FE_PROJECT_CLEAR_MIN_SCORE,
    loading: query.isLoading,
  };
}
