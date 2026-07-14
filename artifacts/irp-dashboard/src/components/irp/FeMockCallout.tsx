import { ExternalLink, FlaskConical } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import { hasClearedFeProject } from "@/lib/assessment";
import { isFeMockLinkOpen } from "@/lib/irpDates";
import { isInFeMockAllowlist } from "@/lib/feMockAllowlist";
import {
  FE_PROJECT_MOCK_TITLE,
  FE_PROJECT_MOCK_URL,
  FE_PROJECT_MOCK_WINDOW_LABEL,
} from "@/lib/feProjectConfig";

interface FeMockCalloutProps {
  assessments: AssessmentResult[];
  userId: string;
}

/** Shown only for allowlisted students who haven't cleared FE Project yet, within the mock window. */
export function FeMockCallout({ assessments, userId }: FeMockCalloutProps) {
  if (!isFeMockLinkOpen()) return null;
  if (!isInFeMockAllowlist(userId)) return null;
  if (hasClearedFeProject(assessments)) return null;

  return (
    <div className="rounded-xl border border-[rgba(103,65,217,0.2)] bg-[linear-gradient(120deg,#f3f0ff_0%,#eef2ff_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-[rgba(103,65,217,0.12)]">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
              Practice · FE Project Mock
            </p>
            <h3 className="font-display text-base font-extrabold text-ink sm:text-lg">
              {FE_PROJECT_MOCK_TITLE}
            </h3>
            <p className="mt-0.5 text-sm text-muted2">
              Practice before the real assessment. Available until 16th July 11:00 PM IST.
            </p>
            <p className="mt-1.5 text-xs font-semibold text-brand">
              🕐 {FE_PROJECT_MOCK_WINDOW_LABEL}
            </p>
          </div>
        </div>

        <a
          href={FE_PROJECT_MOCK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-pop inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl px-5 py-2.5 text-sm font-bold sm:self-center"
        >
          <ExternalLink className="h-4 w-4" />
          Start Mock
        </a>
      </div>
    </div>
  );
}
