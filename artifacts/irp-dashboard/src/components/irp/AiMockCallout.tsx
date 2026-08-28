import { cn } from "@/lib/utils";
import { ArrowRight, Calendar, Mic } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import { hasClearedFeProject } from "@/lib/assessment";
import { isCycle1Cleared } from "@/lib/l1StudentTrack";
import {
  hasNxtmockAttempt,
  isNxtmockCleared,
  type NxtmockInterview,
} from "@/lib/nxtmockInterview";
import {
  NXTMOCK_MAIN_II_BODY,
  NXTMOCK_MAIN_LABEL,
  NXTMOCK_MAIN_TITLE,
  NXTMOCK_MAIN_URL,
  NXTMOCK_MAIN_WINDOW_HINT,
  NXTMOCK_MAIN_WINDOW_LABEL,
  NXTMOCK_MOCK_HINT,
  NXTMOCK_MOCK_LABEL,
  NXTMOCK_MOCK_TITLE,
  NXTMOCK_MOCK_URL,
  NXTMOCK_REATTEMPT_BODY,
} from "@/lib/nxtmockConfig";
import { useStudentAccess } from "@/lib/useStudentAccess";

/**
 * First sit: live grant or static practice URLs.
 * Re-attempt: only show start links when admin uploads a new live grant —
 * never reuse expired/static links. Previous score stays visible either way.
 */
export function AiMockCallout({
  assessments,
  nxtmock,
  className,
  feProjectMinScore,
  userId,
}: {
  assessments: AssessmentResult[];
  nxtmock?: NxtmockInterview | null;
  className?: string;
  feProjectMinScore?: number | null;
  userId?: string;
}) {
  const { findGrant } = useStudentAccess();
  const mainGrant = findGrant("ai_mock", "main") ?? findGrant("ai_mock", "default");
  const mockGrant = findGrant("ai_mock", "mock");
  const liveMainUrl = mainGrant?.url?.trim() || null;
  const liveMockUrl = mockGrant?.url?.trim() || null;

  const clearedL1 = isCycle1Cleared(assessments, userId);
  const feCleared = hasClearedFeProject(assessments, feProjectMinScore);
  const mockCleared = isNxtmockCleared(nxtmock);
  const mockAttempted = hasNxtmockAttempt(nxtmock);
  const isReattempt = mockAttempted && !mockCleared;

  const resolvedMainUrl = isReattempt ? liveMainUrl : liveMainUrl || NXTMOCK_MAIN_URL;
  const resolvedMockUrl = isReattempt ? liveMockUrl : liveMockUrl || NXTMOCK_MOCK_URL;
  const showMain = Boolean(resolvedMainUrl);
  const showMock = Boolean(resolvedMockUrl);

  if (!clearedL1 || !feCleared || mockCleared) return null;
  // Re-attempt with no new grants: still show previous score, no start links.
  if (!isReattempt && !showMain && !showMock) return null;

  return (
    <div
      className={cn(
        "rounded-xl p-4 sm:p-5",
        isReattempt
          ? "border border-[rgba(245,159,0,0.28)] bg-[linear-gradient(120deg,#fff9db_0%,#fff5f5_100%)]"
          : "border border-[rgba(103,65,217,0.22)] bg-[linear-gradient(120deg,#f3f0ff_0%,#eef2ff_100%)]",
        className,
      )}
      aria-labelledby="ai-mock-interview-title"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-[rgba(103,65,217,0.12)]">
          <Mic className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.14em]",
              isReattempt ? "text-[#e67700]" : "text-brand",
            )}
          >
            {isReattempt ? "Interview · Re-attempt" : "Next step · Interview"}
          </p>
          <h3
            id="ai-mock-interview-title"
            className="font-display text-base font-extrabold text-ink sm:text-lg"
          >
            NxtMock AI Interview
          </h3>
          <p className="mt-0.5 text-sm text-muted2">
            {isReattempt
              ? showMain || showMock
                ? NXTMOCK_REATTEMPT_BODY
                : "You attempted the AI Mock Interview but have not cleared yet. A new re-attempt link will appear here when the team releases it."
              : NXTMOCK_MAIN_II_BODY}
          </p>
          {isReattempt && nxtmock?.averageRating != null ? (
            <p className="mt-2 text-sm font-semibold text-[#e67700]">
              Previous score · avg {nxtmock.averageRating.toFixed(1)}
              {nxtmock.attemptNumber != null ? ` · Attempt ${nxtmock.attemptNumber}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {showMain || showMock ? (
        <div
          className={cn(
            "mt-4 grid gap-3",
            showMain && showMock ? "sm:grid-cols-2" : "sm:grid-cols-1",
          )}
        >
          {showMain ? (
            <div className="flex flex-col rounded-xl border border-[rgba(103,65,217,0.22)] bg-white/85 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                Main Interview
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink">{NXTMOCK_MAIN_TITLE}</p>
              <p className="mt-2 inline-flex items-start gap-1.5 text-xs font-semibold text-ink">
                <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                <span>{NXTMOCK_MAIN_WINDOW_LABEL}</span>
              </p>
              <p className="mt-1.5 text-xs text-muted2">{NXTMOCK_MAIN_WINDOW_HINT}</p>
              <a
                href={resolvedMainUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-pop mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold sm:mt-4"
              >
                {NXTMOCK_MAIN_LABEL}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ) : null}

          {showMock ? (
            <div className="flex flex-col rounded-xl border border-[rgba(103,65,217,0.14)] bg-white/70 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0ca678]">
                Mock Interview (practice)
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink">{NXTMOCK_MOCK_TITLE}</p>
              <p className="mt-2 text-xs font-medium text-muted2">{NXTMOCK_MOCK_HINT}</p>
              <a
                href={resolvedMockUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-pop mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold sm:mt-4"
              >
                {NXTMOCK_MOCK_LABEL}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
