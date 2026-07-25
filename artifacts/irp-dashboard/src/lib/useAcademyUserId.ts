import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/authToken";

/**
 * Academy user UUID from SSO (`/api/auth/me`). Prefer this over deriving
 * userId from the student email local-part — production emails are not always
 * `${uuid}@academy.local`.
 */
export function useAcademyUserId(fallback = ""): string {
  const [userId, setUserId] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken();
    const headers: HeadersInit = {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    };

    fetch("/api/auth/me", { headers })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { userId?: string };
      })
      .then((data) => {
        if (cancelled) return;
        const id = data?.userId?.trim();
        if (id) setUserId(id);
      })
      .catch(() => {
        // Keep fallback (email-derived) when /auth/me is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return userId || fallback;
}
