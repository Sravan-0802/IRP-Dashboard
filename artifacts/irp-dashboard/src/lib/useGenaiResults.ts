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

async function fetchGenaiResults(): Promise<GenaiResults> {
  const token = getAuthToken();
  const res = await fetch("/api/student/genai-results", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Could not load GenAI results");
  const body = (await res.json()) as Partial<GenaiResults>;
  return {
    assessments: Array.isArray(body.assessments) ? body.assessments : [],
    interviews: Array.isArray(body.interviews) ? body.interviews : [],
  };
}

export function useGenaiResults(): GenaiResults & { loading: boolean } {
  const query = useQuery({
    queryKey: ["student", "genai-results"],
    queryFn: fetchGenaiResults,
    staleTime: 60_000,
    retry: 1,
  });
  return { ...(query.data ?? EMPTY), loading: query.isLoading };
}
