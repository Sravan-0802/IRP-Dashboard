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
  expiresAt?: string | null;
};

const STUDENT_ACCESS_KEY = ["student", "access"] as const;

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
