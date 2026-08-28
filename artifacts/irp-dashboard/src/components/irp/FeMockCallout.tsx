import { ExternalLink, FlaskConical } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import { hasAttemptedFeProject, hasClearedFeProject } from "@/lib/assessment";
import { isFeMockLinkOpen } from "@/lib/irpDates";
import { isInFeMockAllowlist } from "@/lib/feMockAllowlist";
import {
  FE_PROJECT_MOCK_AVAILABLE_UNTIL,
  FE_PROJECT_MOCK_TITLE,
  FE_PROJECT_MOCK_URL,
  FE_PROJECT_MOCK_WINDOW_LABEL,
} from "@/lib/feProjectConfig";
import { useStudentAccess } from "@/lib/useStudentAccess";

interface FeMockCalloutProps {
  assessments: AssessmentResult[];
  userId: string;
  feProjectMinScore?: number | null;
}

/**
 * FE mock practice link. After a student has already sat FE (reattempt track),
 * only a live admin grant shows the button — never the stale static URL.
 */
export function FeMockCallout({ assessments, userId, feProjectMinScore }: FeMockCalloutProps) {
  const { findGrant } = useStudentAccess();
  const grant = findGrant("fe_project", "mock");
  const liveGrantUrl = grant?.url?.trim() || null;

  if (hasClearedFeProject(assessments, feProjectMinScore)) return null;

  const alreadyAttempted = hasAttemptedFeProject(assessments);
  // Re-attempt track: grant only. First sit: grant or allowlist date window.
  const href = alreadyAttempted
    ? liveGrantUrl
    : liveGrantUrl ||
      (isFeMockLinkOpen() && isInFeMockAllowlist(userId) ? FE_PROJECT_MOCK_URL : null);

  if (!href) return null;

  return (
    <div className="rounded-xl border border-[rgba(103,65,217,0.2)] bg-[linear-gradient(120deg,#f3f0ff_0%,#eef2ff_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-[rgba(103,65,217,0.12)]">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
              FE Project · {liveGrantUrl ? "Mock" : "Main Assessment"}
            </p>
            <h3 className="font-display text-base font-extrabold text-ink sm:text-lg">
              {FE_PROJECT_MOCK_TITLE}
            </h3>
            <p className="mt-0.5 text-sm text-muted2">
              {liveGrantUrl
                ? "Your FE Project mock link is ready."
                : `Complete the FE Project Main assessment. Available until ${FE_PROJECT_MOCK_AVAILABLE_UNTIL}.`}
            </p>
            {!liveGrantUrl ? (
              <p className="mt-1.5 text-xs font-semibold text-brand">
                🕐 {FE_PROJECT_MOCK_WINDOW_LABEL}
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
