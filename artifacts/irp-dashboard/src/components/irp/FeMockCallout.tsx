import { ExternalLink, FlaskConical, Timer } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import { hasClearedFeProject } from "@/lib/assessment";
import { FE_PROJECT_MOCK_TITLE } from "@/lib/feProjectConfig";
import { useStudentAccess } from "@/lib/useStudentAccess";
import { useCountdown } from "@/lib/useCountdown";

interface FeMockCalloutProps {
  assessments: AssessmentResult[];
  userId: string;
  feProjectMinScore?: number | null;
}

/** FE mock link — only from a live `fe_project` mock access-grant row. */
/** Unused; kept for call-site compatibility. */
export function FeMockCallout({ assessments, feProjectMinScore }: FeMockCalloutProps) {
  const { findGrant } = useStudentAccess();
  const grant = findGrant("fe_project", "mock");
  const href = grant?.url?.trim() || null;
  const { timeLeft } = useCountdown(grant?.expiresAt);

  if (hasClearedFeProject(assessments, feProjectMinScore) || !href) return null;

  return (
    <div className="rounded-xl border border-[rgba(103,65,217,0.2)] bg-[linear-gradient(120deg,#f3f0ff_0%,#eef2ff_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-[rgba(103,65,217,0.12)]">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
              FE Project · Mock
            </p>
            <h3 className="font-display text-base font-extrabold text-ink sm:text-lg">
              {FE_PROJECT_MOCK_TITLE}
            </h3>
            <p className="mt-0.5 text-sm text-muted2">Your FE Project mock link is ready.</p>
            {timeLeft ? (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-[rgba(103,65,217,0.08)] px-2 py-1 text-xs font-bold text-brand">
                <Timer className="h-3 w-3 shrink-0" />
                {timeLeft} remaining
              </p>
            ) : null}
          </div>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-pop inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl px-5 py-2.5 text-sm font-bold sm:self-center"
        >
          <ExternalLink className="h-4 w-4" />
          Start Assessment
        </a>
      </div>
    </div>
  );
}
