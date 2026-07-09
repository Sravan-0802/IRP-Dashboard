import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "./authToken";
import type { NxtmockInterviewResponse } from "./nxtmockInterview";

const NXTMOCK_KEY = ["student", "nxtmock-interview"] as const;

async function api<T>(url: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function useNxtmockInterview() {
  return useQuery({
    queryKey: NXTMOCK_KEY,
    queryFn: () => api<NxtmockInterviewResponse>("/api/student/nxtmock-interview"),
    retry: false,
  });
}
