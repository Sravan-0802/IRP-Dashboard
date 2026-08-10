import { CheckCircle2, FileCode2, Lock } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import {
  assessmentOverallPct,
  feResultLabel,
  feResultTone,
  getExamDateLabelForAssessment,
  hasClearedFeProject,
  listAttemptedFeProjectAssessments,
  pickFeProjectAssessment,
} from "@/lib/assessment";
import { isCycle1Cleared } from "@/lib/l1StudentTrack";
import {
  FE_PROJECT_CLEARED_BODY,
  FE_PROJECT_CLEAR_MIN_SCORE,
  FE_PROJECT_MAIN_II_TITLE,
  FE_PROJECT_RESULTS_TITLE,
} from "@/lib/feProjectConfig";
import { Pill } from "./ui";

export function FeProjectResults({
  journey,
  assessments,
  visible = true,
  feProjectMinScore,
  userId,
}: {
  journey: Journey;
  assessments: AssessmentResult[];
  visible?: boolean;
  feProjectMinScore?: number | null;
  userId?: string;
}) {
  const threshold = feProjectMinScore ?? FE_PROJECT_CLEAR_MIN_SCORE;
  const clearedL1 = isCycle1Cleared(assessments, userId);
  const feCleared = hasClearedFeProject(assessments, threshold);
  const fe = pickFeProjectAssessment(assessments);
  const hasScoreData = fe != null && feCleared;
  const attemptedHistory = listAttemptedFeProjectAssessments(assessments);
  const previousSits = attemptedHistory.slice(1);

  if (!clearedL1 || !feCleared || !fe) return null;

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
  const scoreLabel = hasScoreData
    ? `${Math.round(fe.overallScore)}/${Math.round(fe.overallMax)}`
    : null;
  const latestDateLabel = getExamDateLabelForAssessment(fe);
  const latestClears = fe.overallScore >= threshold;

  return (
    <div
      id="fe-project-results"
      className="scroll-mt-24 w-full overflow-hidden rounded-xl border border-[rgba(12,166,120,0.2)] bg-white shadow-soft"
    >
      <div className="flex items-stretch">
        <div className="w-1 shrink-0 bg-gradient-to-b from-[#0ca678] to-[#2f9e44]" aria-hidden />

        <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8faf0] text-teal ring-1 ring-[rgba(12,166,120,0.15)]">
              <FileCode2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h3 className="font-display text-sm font-extrabold text-ink">{FE_PROJECT_RESULTS_TITLE}</h3>
                <span className="hidden text-[11px] text-muted2 sm:inline">· {title}</span>
              </div>
              <p className="truncate text-[11px] text-muted2 sm:hidden">{title}</p>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted2">{FE_PROJECT_CLEARED_BODY}</p>
              <p className="mt-0.5 text-[10px] text-muted2">
                Latest: {latestDateLabel}
                {!latestClears
                  ? " · Cleared on an earlier sit (≥18/20)"
                  : previousSits.length > 0
                    ? " · Earlier sits listed below"
                    : ""}
              </p>
            </div>
          </div>

          {hasScoreData && fe ? (
            <div className="flex min-w-0 items-center gap-3 sm:max-w-[280px] sm:flex-1 sm:justify-end">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-muted2">
                  <span>Score</span>
                  <span className="text-teal">{overallPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[rgba(12,166,120,0.12)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0ca678] to-[#74c947] transition-all duration-700"
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
              </div>
              <p className="shrink-0 font-display text-lg font-black leading-none text-ink">
                {scoreLabel}
              </p>
            </div>
          ) : null}

          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <Pill tone="green" className="px-2 py-0.5 text-[9px]">
              Cleared
            </Pill>
            <CheckCircle2 className="hidden h-5 w-5 text-teal sm:block" aria-hidden />
          </div>
        </div>
      </div>

      {previousSits.length > 0 ? (
        <div className="border-t border-[rgba(12,166,120,0.12)] px-3.5 py-3 sm:px-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
            Previous FE attempts
          </p>
          <div className="overflow-hidden rounded-xl border border-[rgba(12,166,120,0.12)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(12,166,120,0.10)] bg-[rgba(12,166,120,0.04)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Assessment</th>
                  <th className="px-3 py-2">Overall</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {previousSits.map((sit) => {
                  const pct = assessmentOverallPct(sit);
                  const sitTitle = sit.assessmentTitle?.trim() || "FE Project";
                  return (
                    <tr
                      key={`${sit.organisationAssessmentId}-${sit.assessmentStartDatetime ?? ""}`}
                      className="border-b border-[rgba(12,166,120,0.06)] last:border-b-0"
                    >
                      <td className="px-3 py-2.5 font-medium text-ink">
                        {getExamDateLabelForAssessment(sit)}
                      </td>
                      <td className="px-3 py-2.5 text-[#6e6a8a]">{sitTitle}</td>
                      <td className="px-3 py-2.5 text-[#6e6a8a]">
                        {Math.round(sit.overallScore)}/{Math.round(sit.overallMax)} ({pct}%)
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill tone={feResultTone(sit, threshold)}>
                          {feResultLabel(sit, threshold)}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
