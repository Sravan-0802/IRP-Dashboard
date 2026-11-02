import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GenaiProjectSubmissionInput,
  GenaiProjectSubmissionResponse,
} from "@workspace/api-client-react";
import { getAuthToken } from "@/lib/authToken";

const SUBMISSION_KEY = ["student", "genai-project-submission"] as const;
const SUBMISSION_URL = "/api/student/genai-project-submission";

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
    onSuccess: (data) => {
      queryClient.setQueryData(SUBMISSION_KEY, data);
    },
  });

  return { query, save };
}
