import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/authToken";
import { trackEvent } from "@/lib/analytics";

const SUBMISSION_KEY = ["student", "genai-project-submission"] as const;
const SUBMISSION_URL = "/api/student/genai-project-submission";
type GenaiProjectSubmissionInput = { projectTitle: string; loomUrl: string; selectedProjects: string[] };
type GenaiProjectSubmissionResponse = {
  submission: { projectTitle: string; loomUrl: string; updatedAt: string } | null;
};

const GENAI_PROJECT_ANALYTICS_KEYS: Record<string, string> = {
  "Intelligent RAG Challenge": "intelligent_rag",
  "Agentic RAG Challenge": "agentic_rag",
  "Building & Optimizing RAG Challenge": "building_optimizing_rag",
};

async function requestSubmission(
  init?: RequestInit,
): Promise<GenaiProjectSubmissionResponse> {
  const token = getAuthToken();
  const response = await fetch(SUBMISSION_URL, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status}). Please try again.`;
    throw new Error(message);
  }
  return payload as GenaiProjectSubmissionResponse;
}

export function useGenaiProjectSubmission(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SUBMISSION_KEY,
    queryFn: () => requestSubmission(),
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const save = useMutation({
    mutationFn: (input: GenaiProjectSubmissionInput) =>
      requestSubmission({ method: "PUT", body: JSON.stringify(input) }),
    onMutate: () => ({
      wasExistingSubmission: Boolean(
        queryClient.getQueryData<GenaiProjectSubmissionResponse>(SUBMISSION_KEY)?.submission,
      ),
    }),
    onSuccess: (data, variables, mutationContext) => {
      queryClient.setQueryData(SUBMISSION_KEY, data);
      const project = GENAI_PROJECT_ANALYTICS_KEYS[variables.projectTitle];
      if (!data.submission || !project) return;

      trackEvent("genai_loom_submission_succeeded", {
        project,
        submission_type: mutationContext?.wasExistingSubmission ? "updated" : "new",
      });
    },
  });

  return { query, save };
}
