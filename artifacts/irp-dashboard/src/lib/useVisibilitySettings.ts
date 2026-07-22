import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/authToken";

export type VisibilitySettings = {
  onlineL1Results: boolean;
  feProjectResults: boolean;
  aiMockResults: boolean;
  humanInterviewResults: boolean;
  courseProgress: boolean;
  updatedAt: string | null;
};

/** Conservative client defaults while loading — hide exam results until API says otherwise. */
const DEFAULTS: VisibilitySettings = {
  onlineL1Results: false,
  feProjectResults: false,
  aiMockResults: false,
  humanInterviewResults: false,
  courseProgress: true,
  updatedAt: null,
};

const VISIBILITY_KEY = ["student", "visibility-settings"] as const;

async function fetchVisibilitySettings(): Promise<VisibilitySettings> {
  const token = getAuthToken();
  const res = await fetch("/api/student/visibility-settings", {
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error("Could not load visibility settings");
  }
  const data = (await res.json()) as Partial<VisibilitySettings>;
  return {
    onlineL1Results: data.onlineL1Results ?? false,
    feProjectResults: data.feProjectResults ?? false,
    aiMockResults: data.aiMockResults ?? false,
    humanInterviewResults: data.humanInterviewResults ?? false,
    courseProgress: data.courseProgress ?? true,
    updatedAt: data.updatedAt ?? null,
  };
}

export function useVisibilitySettings() {
  const query = useQuery({
    queryKey: VISIBILITY_KEY,
    queryFn: fetchVisibilitySettings,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
    retry: 1,
  });

  return {
    settings: query.data ?? DEFAULTS,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
