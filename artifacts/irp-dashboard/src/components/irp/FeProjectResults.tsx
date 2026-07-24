import { CheckCircle2, FileCode2, Lock } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import {
  FE_PROJECT_C2_CLEARED_BODY,
  FE_PROJECT_C2_NOT_CLEARED_BODY,
  FE_PROJECT_MAIN_II_CLEARED_BODY,
  FE_PROJECT_MAIN_II_NOT_CLEARED_BODY,
  FE_PROJECT_MAIN_II_TITLE,
  FE_PROJECT_RESULTS_TITLE,
} from "@/lib/feProjectConfig";
import {
  assessmentOverallPct,
  feProjectClearScore,
  hasAttemptedFeProject,
  hasClearedFeProject,
  isFeProjectC2,
  pickFeProjectAssessment,
} from "@/lib/assessment";
import { isFeProjectC2CohortUser } from "@/lib/feProjectC2Cohort";
import { isCycle1Cleared } from "@/lib/l1StudentTrack";
import { Pill } from "./ui";

function formatFeScore(score: number, max: number): string {
  const s = Number.isInteger(score) ? String(score) : score.toFixed(2).replace(/\.?0+$/, "");
  return `${s}/${Math.round(max)}`;
}

/**
 * FE Project score card for L1-cleared students who have an FE attempt.
 * Shows score + Cleared (≥18/20 for C2/cohort, 100% for Main II) or Not cleared.
 */
export function FeProjectResults({
  journey,
  assessments,
  visible = true,
<<<<<<< HEAD
  feProjectMinScore,
=======
  userId,
>>>>>>> fcd5aa89106b64c9d6b76bc66540be874a0805a4
}: {
  journey: Journey;
  assessments: AssessmentResult[];
  visible?: boolean;
<<<<<<< HEAD
  feProjectMinScore?: number | null;
}) {
  const clearedL1 = isCycle1Cleared(assessments);
  const feCleared = hasClearedFeProject(assessments, feProjectMinScore);
  const fe = pickFeProjectAssessment(assessments);
  const hasScoreData = fe != null && feCleared;
=======
  userId?: string;
}) {
  const clearedL1 = isCycle1Cleared(assessments);
  const feCleared = hasClearedFeProject(assessments, userId);
  const feAttempted = hasAttemptedFeProject(assessments);
  const fe = pickFeProjectAssessment(assessments, userId);
>>>>>>> fcd5aa89106b64c9d6b76bc66540be874a0805a4

  if (!clearedL1 || !feAttempted || !fe) return null;

  if (!visible) {
    return (
      <div
        id="fe-project-results"
        className="scroll-mt-24 flex items-center gap-2.5 rounded-xl border border-[rgba(103,65,217,0.1)] bg-white px-4 py-3 shadow-soft"
      >
        <Lock className="h-4 w-4 shrink-0 text-muted2" />
        <p className="text-xs font-medium text-muted2">
          FE Project results are being processed. They will appear here once released.
        </p>
      </div>
    );
  }

  const title = fe.assessmentTitle?.trim() || FE_PROJECT_MAIN_II_TITLE;
  const overallPct = assessmentOverallPct(fe);
  const scoreLabel = formatFeScore(fe.overallScore, fe.overallMax);
  const required = feProjectClearScore(fe, userId);
  const useEighteen = isFeProjectC2(fe) || isFeProjectC2CohortUser(userId);
  const body = feCleared
    ? useEighteen
      ? FE_PROJECT_C2_CLEARED_BODY
      : FE_PROJECT_MAIN_II_CLEARED_BODY
    : useEighteen
      ? FE_PROJECT_C2_NOT_CLEARED_BODY
      : FE_PROJECT_MAIN_II_NOT_CLEARED_BODY;

  return (
    <div
      id="fe-project-results"
      className={`scroll-mt-24 w-full overflow-hidden rounded-xl border bg-white shadow-soft ${
        feCleared
          ? "border-[rgba(12,166,120,0.2)]"
          : "border-[rgba(245,159,0,0.28)]"
      }`}
    >
      <div className="flex items-stretch">
        <div
          className={`w-1 shrink-0 ${
            feCleared
              ? "bg-gradient-to-b from-[#0ca678] to-[#2f9e44]"
              : "bg-gradient-to-b from-[#f59f00] to-[#e67700]"
          }`}
          aria-hidden
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${
                feCleared
                  ? "bg-[#e8faf0] text-teal ring-[rgba(12,166,120,0.15)]"
                  : "bg-[#fff4e6] text-[#e67700] ring-[rgba(245,159,0,0.2)]"
              }`}
            >
              <FileCode2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h3 className="font-display text-sm font-extrabold text-ink">{FE_PROJECT_RESULTS_TITLE}</h3>
                <span className="hidden text-[11px] text-muted2 sm:inline">· {title}</span>
              </div>
              <p className="truncate text-[11px] text-muted2 sm:hidden">{title}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted2">{body}</p>
              <p className="mt-1 text-[11px] font-semibold text-muted2">
                Required · {required}/{Math.round(fe.overallMax)}
                {useEighteen ? " (18+)" : " (100%)"}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-3 sm:max-w-[280px] sm:flex-1 sm:justify-end">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-muted2">
                <span>Score</span>
                <span className={feCleared ? "text-teal" : "text-[#e67700]"}>{overallPct}%</span>
              </div>
              <div
                className={`h-2 overflow-hidden rounded-full ${
                  feCleared ? "bg-[rgba(12,166,120,0.12)]" : "bg-[rgba(245,159,0,0.15)]"
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    feCleared
                      ? "bg-gradient-to-r from-[#0ca678] to-[#74c947]"
                      : "bg-gradient-to-r from-[#f59f00] to-[#fab005]"
                  }`}
                  style={{ width: `${Math.min(100, overallPct)}%` }}
                />
              </div>
            </div>
            <p className="shrink-0 font-display text-lg font-black leading-none text-ink">
              {scoreLabel}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <Pill tone={feCleared ? "green" : "amber"} className="px-2 py-0.5 text-[9px]">
              {feCleared ? "Cleared" : "Not cleared"}
            </Pill>
            {feCleared ? (
              <CheckCircle2 className="hidden h-5 w-5 text-teal sm:block" aria-hidden />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
