import { cn } from "@/lib/utils";
import { ArrowRight, ExternalLink, FileCode2 } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { isCycle1Cleared } from "@/lib/l1StudentTrack";
import {
  assessmentOverallPct,
  hasAttemptedFeProject,
  hasClearedFeProject,
  pickFeProjectAssessment,
  resultLabel,
} from "@/lib/assessment";
import {
  FE_PROJECT_MAIN_II_BODY,
  FE_PROJECT_MAIN_II_LABEL,
  FE_PROJECT_MAIN_II_TITLE,
  FE_PROJECT_MAIN_II_URL,
  FE_PROJECT_REATTEMPT_BODY,
  FE_PROJECT_REATTEMPT_LABEL,
} from "@/lib/feProjectConfig";
import { Pill } from "./ui";

/** Shown for cleared L1 students who have not yet completed FE Project Main II. */
export function FeProjectCallout({
  journey,
  assessments,
  className,
  feProjectMinScore,
}: {
  journey: Journey;
  assessments: AssessmentResult[];
  className?: string;
  feProjectMinScore?: number | null;
}) {
  const clearedL1 = isCycle1Cleared(assessments);
  const feCleared = hasClearedFeProject(assessments, feProjectMinScore);
  const feAttempted = hasAttemptedFeProject(assessments);
  const feAssessment = pickFeProjectAssessment(assessments);
  const fePct = feAssessment ? assessmentOverallPct(feAssessment) : 0;
  const isReattempt = feAttempted && !feCleared;

  if (!clearedL1 || feCleared) return null;

  return (
    <div
      className={cn(
        "mt-4 rounded-xl p-4 sm:p-5",
        isReattempt
          ? "border border-[rgba(245,159,0,0.28)] bg-[linear-gradient(120deg,#fff9db_0%,#fff5f5_100%)]"
          : "border border-[rgba(12,166,120,0.22)] bg-[linear-gradient(120deg,#f0fdf4_0%,#eef2ff_100%)]",
        className,
      )}
      aria-labelledby="fe-project-main-ii-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-teal shadow-sm ring-1 ring-[rgba(12,166,120,0.12)]">
            <FileCode2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.14em]",
                isReattempt ? "text-[#e67700]" : "text-teal",
              )}
            >
              {isReattempt ? "FE Project · Re-attempt" : "Next step · FE Project"}
            </p>
            <h3
              id="fe-project-main-ii-title"
              className="font-display text-base font-extrabold text-ink sm:text-lg"
            >
              {FE_PROJECT_MAIN_II_TITLE}
            </h3>
            <p className="mt-0.5 text-sm text-muted2">
              {isReattempt ? FE_PROJECT_REATTEMPT_BODY : FE_PROJECT_MAIN_II_BODY}
            </p>
            {isReattempt ? (
              <div className="mt-2">
                <Pill tone="amber">
                  {resultLabel(fePct)} · {fePct}%
                </Pill>
              </div>
            ) : null}
          </div>
        </div>

        <a
          href={FE_PROJECT_MAIN_II_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-pop inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl px-5 py-2.5 text-sm font-bold sm:self-center"
        >
          {isReattempt ? FE_PROJECT_REATTEMPT_LABEL : FE_PROJECT_MAIN_II_LABEL}
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-muted2 sm:mt-4">
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        Opens Topin Assessment in a new tab
      </p>
    </div>
  );
}
