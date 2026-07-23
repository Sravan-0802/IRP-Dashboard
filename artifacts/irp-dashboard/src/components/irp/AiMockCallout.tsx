import { cn } from "@/lib/utils";
import { ArrowRight, ExternalLink, Mic } from "lucide-react";
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
  NXTMOCK_MAIN_II_LABEL,
  NXTMOCK_MAIN_II_TITLE,
  NXTMOCK_MAIN_II_URL,
  NXTMOCK_REATTEMPT_BODY,
  NXTMOCK_REATTEMPT_LABEL,
} from "@/lib/nxtmockConfig";

/** Shown for FE-cleared L1 students who still need to clear the AI Mock Interview. */
export function AiMockCallout({
  assessments,
  nxtmock,
  className,
}: {
  assessments: AssessmentResult[];
  nxtmock?: NxtmockInterview | null;
  className?: string;
}) {
  const clearedL1 = isCycle1Cleared(assessments);
  const feCleared = hasClearedFeProject(assessments);
  const mockCleared = isNxtmockCleared(nxtmock);
  const mockAttempted = hasNxtmockAttempt(nxtmock);
  const isReattempt = mockAttempted && !mockCleared;

  if (!clearedL1 || !feCleared || mockCleared) return null;

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              {isReattempt ? "AI Mock Interview · Re-attempt" : "Next step · AI Mock Interview"}
            </p>
            <h3
              id="ai-mock-interview-title"
              className="font-display text-base font-extrabold text-ink sm:text-lg"
            >
              {NXTMOCK_MAIN_II_TITLE}
            </h3>
            <p className="mt-0.5 text-sm text-muted2">
              {isReattempt ? NXTMOCK_REATTEMPT_BODY : NXTMOCK_MAIN_II_BODY}
            </p>
          </div>
        </div>

        <a
          href={NXTMOCK_MAIN_II_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-pop inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl px-5 py-2.5 text-sm font-bold sm:self-center"
        >
          {isReattempt ? NXTMOCK_REATTEMPT_LABEL : NXTMOCK_MAIN_II_LABEL}
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-muted2 sm:mt-4">
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        Opens AI Mock Interview in a new tab
      </p>
    </div>
  );
}
