import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Journey, JourneyState } from "./journey";
import { getAuthToken } from "./authToken";

const JOURNEY_KEY = ["student", "journey"] as const;

export class ApiError extends Error {
  status: number;
  requestId: string | null;

  constructor(message: string, status: number, requestId: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const requestId = res.headers.get("x-request-id");
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status, requestId);
  }
  return data as T;
}

export function useJourney() {
  return useQuery({
    queryKey: JOURNEY_KEY,
    queryFn: () => api<Journey>("/api/student/journey"),
    retry: false,
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: "standard" | "wildcard") =>
      api<Journey>("/api/student/journey/onboard", {
        method: "POST",
        body: JSON.stringify({ path }),
      }),
    onSuccess: (data) => qc.setQueryData(JOURNEY_KEY, data),
  });
}

export function useSwitchPath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (to: "standard" | "wildcard") =>
      api<Journey>("/api/student/journey/switch", {
        method: "POST",
        body: JSON.stringify({ to }),
      }),
    onSuccess: (data) => qc.setQueryData(JOURNEY_KEY, data),
  });
}

export function useSetJourneyState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (state: JourneyState) =>
      api<Journey>("/api/student/journey/state", {
        method: "POST",
        body: JSON.stringify({ state }),
      }),
    onSuccess: (data) => qc.setQueryData(JOURNEY_KEY, data),
  });
}
