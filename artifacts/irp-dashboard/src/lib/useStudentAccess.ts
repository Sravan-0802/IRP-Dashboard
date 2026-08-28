import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/authToken";
import type { L1AccessStage } from "@/lib/l1StageAccessMatrix";

export type AccessStage = L1AccessStage;
export type AccessLinkKind = "mock" | "main" | "default";

export type StudentAccessGrant = {
  stage: AccessStage;
  linkKind: AccessLinkKind;
  url: string;
  batchId: number;
  name: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
};

const STUDENT_ACCESS_KEY = ["student", "access"] as const;

/** True when a grant window is currently live (started and not expired). */
export function isAccessGrantLive(
  grant: Pick<StudentAccessGrant, "startsAt" | "expiresAt"> | null | undefined,
  now = Date.now(),
): boolean {
  if (!grant) return false;
  if (grant.startsAt) {
    const start = new Date(grant.startsAt).getTime();
    if (!Number.isNaN(start) && start > now) return false;
  }
  if (grant.expiresAt) {
    const end = new Date(grant.expiresAt).getTime();
    if (!Number.isNaN(end) && end <= now) return false;
  }
  return true;
}

/** True when an assessment's scheduled end datetime has already passed. */
export function isAssessmentWindowEnded(
  endIso: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!endIso) return false;
  const end = new Date(endIso).getTime();
  if (Number.isNaN(end)) return false;
  return end <= now;
}

async function fetchStudentAccess(): Promise<{ grants: StudentAccessGrant[] }> {
  const token = getAuthToken();
  const res = await fetch("/api/student/access", {
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error("Could not load access grants");
  return res.json() as Promise<{ grants: StudentAccessGrant[] }>;
}

/** Prefer exact linkKind match; for default-only stages, accept any kind. */
export function findAccessGrant(
  grants: StudentAccessGrant[] | undefined,
  stage: AccessStage,
  linkKind?: AccessLinkKind,
): StudentAccessGrant | undefined {
  if (!grants?.length) return undefined;
  // API already returns only live grants; keep helpers for client-side window checks.
  const forStage = grants.filter((g) => g.stage === stage);
  if (forStage.length === 0) return undefined;
  if (!linkKind) return forStage[0];
  return (
    forStage.find((g) => g.linkKind === linkKind) ??
    (linkKind !== "default" ? undefined : forStage.find((g) => g.linkKind === "default"))
  );
}

export function useStudentAccess() {
  const query = useQuery({
    queryKey: STUDENT_ACCESS_KEY,
    queryFn: fetchStudentAccess,
    staleTime: 60_000,
    retry: 1,
  });
  return {
    grants: query.data?.grants ?? [],
    loading: query.isLoading,
    findGrant: (stage: AccessStage, linkKind?: AccessLinkKind) =>
      findAccessGrant(query.data?.grants, stage, linkKind),
  };
}
