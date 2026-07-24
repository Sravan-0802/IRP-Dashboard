import { AlertTriangle } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { isCycle1Cleared } from "@/lib/l1StudentTrack";
import {
  assessmentOverallPct,
  hasAttemptedFeProject,
  hasClearedFeProject,
  pickFeProjectAssessment,
} from "@/lib/assessment";
import {
  FE_PROJECT_NOT_CLEARED_BODY,
  FE_PROJECT_NOT_CLEARED_EYEBROW,
  FE_PROJECT_NOT_CLEARED_TITLE,
} from "@/lib/feProjectConfig";
import { Pill } from "./ui";

/**
 * Shown for cleared-L1 students who attempted the FE Project but have not
 * cleared it (anything short of a perfect 20/20). Informational only — no
 * external assessment link.
 */
export function FeProjectNotClearedNotice({
  journey,
  assessments,
  feProjectMinScore,
}: {
  journey: Journey;
  assessments: AssessmentResult[];
  feProjectMinScore?: number | null;
}) {
  const clearedL1 = isCycle1Cleared(assessments);
  const feCleared = hasClearedFeProject(assessments, feProjectMinScore);
  const feAttempted = hasAttemptedFeProject(assessments);

  if (!clearedL1 || feCleared || !feAttempted) return null;

  const fe = pickFeProjectAssessment(assessments);
  const pct = fe ? assessmentOverallPct(fe) : 0;
  const score = fe?.overallScore ?? 0;
  const max = fe?.overallMax ?? 20;

  return (
    <div
      className="rounded-xl border border-[rgba(245,159,0,0.28)] bg-[linear-gradient(120deg,#fff9db_0%,#fff5f5_100%)] p-4 sm:p-5"
      aria-labelledby="fe-project-not-cleared-title"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#e67700] shadow-sm ring-1 ring-[rgba(245,159,0,0.15)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e67700]">
            {FE_PROJECT_NOT_CLEARED_EYEBROW}
          </p>
          <h3
            id="fe-project-not-cleared-title"
            className="font-display text-base font-extrabold text-ink sm:text-lg"
          >
            {FE_PROJECT_NOT_CLEARED_TITLE}
          </h3>
          <p className="mt-0.5 text-sm text-muted2">{FE_PROJECT_NOT_CLEARED_BODY}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone="amber">
              Your score · {score}/{max} ({pct}%)
            </Pill>
            <Pill tone="green">
              Required · {feProjectMinScore != null ? feProjectMinScore : max}/{max} ({feProjectMinScore != null ? Math.round((feProjectMinScore / max) * 100) : 100}%)
            </Pill>
          </div>
        </div>
      </div>
    </div>
  );
}
