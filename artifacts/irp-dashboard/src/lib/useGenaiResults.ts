import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/authToken";

export type GenaiAssessmentStatus =
  | "QUALIFIED"
  | "NOT_QUALIFIED"
  | "RESULT_PENDING"
  | "NOT_ATTEMPTED"
  | "UPCOMING";

export type GenaiAssessmentResult = {
  id: string;
  title: string;
  tag: string | null;
  number: string | null;
  startsAt: string | null;
  attemptedAt: string | null;
  status: GenaiAssessmentStatus;
  mcqScore: number | null;
  mcqMax: number | null;
  codingScore: number | null;
  codingMax: number | null;
  totalScore: number | null;
  totalMax: number | null;
};

export type GenaiInterviewResult = {
  id: string;
  tag: string | null;
  number: string | null;
  attemptedAt: string | null;
  status: "COMPLETED" | "NOT_ATTEMPTED";
  averageRating: number | null;
  sections: { key: string; label: string; rating: number | null }[];
};

export type GenaiResults = {
  assessments: GenaiAssessmentResult[];
  interviews: GenaiInterviewResult[];
};

const EMPTY: GenaiResults = { assessments: [], interviews: [] };
const AUTH_REQUIRED_MESSAGE =
  "Your session could not be verified. Refresh the page and sign in again.";
const RESULTS_LOAD_ERROR_MESSAGE =
  "GenAI assessment results could not be loaded. Please try again.";

async function fetchGenaiResults(): Promise<GenaiResults> {
  const token = getAuthToken();
  const res = await fetch("/api/student/genai-results", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? AUTH_REQUIRED_MESSAGE : RESULTS_LOAD_ERROR_MESSAGE);
  }
  const body = (await res.json()) as Partial<GenaiResults>;
  return {
    assessments: Array.isArray(body.assessments) ? body.assessments : [],
    interviews: Array.isArray(body.interviews) ? body.interviews : [],
  };
}

export function useGenaiResults(): GenaiResults & {
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const query = useQuery({
    queryKey: ["student", "genai-results"],
    queryFn: fetchGenaiResults,
    staleTime: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const error = query.isError
    ? query.error instanceof Error &&
      (query.error.message === AUTH_REQUIRED_MESSAGE || query.error.message === RESULTS_LOAD_ERROR_MESSAGE)
      ? query.error.message
      : RESULTS_LOAD_ERROR_MESSAGE
    : null;
  return {
    ...(query.data ?? EMPTY),
    loading: query.isLoading,
    error,
    retry: () => {
      void query.refetch();
    },
  };
}
