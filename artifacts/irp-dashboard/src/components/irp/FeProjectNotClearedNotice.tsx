import { AlertTriangle } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { isCycle1Cleared } from "@/lib/l1StudentTrack";
import {
  assessmentOverallPct,
  feResultLabel,
  feResultTone,
  getExamDateLabelForAssessment,
  hasAttemptedFeProject,
  hasClearedFeProject,
  listAttemptedFeProjectAssessments,
  pickFeProjectAssessment,
} from "@/lib/assessment";
import {
  FE_PROJECT_CLEAR_MIN_SCORE,
  FE_PROJECT_NOT_CLEARED_BODY,
  FE_PROJECT_NOT_CLEARED_EYEBROW,
  FE_PROJECT_NOT_CLEARED_TITLE,
} from "@/lib/feProjectConfig";
import { useStudentAccess } from "@/lib/useStudentAccess";
import { Pill } from "./ui";

/**
 * Shown when the student attempted FE but has not cleared — score only, no link.
 * When admin uploads a live re-attempt grant, FeProjectCallout shows score + CTA instead.
 */
export function FeProjectNotClearedNotice({
  journey,
  assessments,
  feProjectMinScore,
  userId,
}: {
  journey: Journey;
  assessments: AssessmentResult[];
  feProjectMinScore?: number | null;
  userId?: string;
}) {
  const { findGrant } = useStudentAccess();
  const liveReattemptGrant = findGrant("fe_project", "main");
  const threshold = feProjectMinScore ?? FE_PROJECT_CLEAR_MIN_SCORE;
  const clearedL1 = isCycle1Cleared(assessments, userId);
  const feCleared = hasClearedFeProject(assessments, threshold);
  const feAttempted = hasAttemptedFeProject(assessments);

  if (!clearedL1 || feCleared || !feAttempted) return null;
  // Live grant → FeProjectCallout owns the re-attempt CTA + score pill.
  if (liveReattemptGrant?.url?.trim()) return null;

  const fe = pickFeProjectAssessment(assessments);
  const pct = fe ? assessmentOverallPct(fe) : 0;
  const score = fe?.overallScore ?? 0;
  const max = fe?.overallMax ?? 20;
  const previousSits = listAttemptedFeProjectAssessments(assessments);

  return (
    <div
      className="rounded-xl border border-[rgba(245,159,0,0.28)] bg-[linear-gradient(120deg,#fff9db_0%,#fff5f5_100%)] p-4 sm:p-5"
      aria-labelledby="fe-project-not-cleared-title"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#e67700] shadow-sm ring-1 ring-[rgba(245,159,0,0.15)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
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
              Latest · {score}/{max} ({pct}%)
            </Pill>
            <Pill tone="green">
              Required · {threshold}/{max} ({Math.round((threshold / max) * 100)}%)
            </Pill>
          </div>

          {previousSits.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                Previous FE attempts
              </p>
              <div className="overflow-hidden rounded-xl border border-[rgba(245,159,0,0.2)] bg-white/70">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(245,159,0,0.12)] bg-[rgba(245,159,0,0.06)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                      <th className="px-3 py-2">Cycle</th>
                      <th className="px-3 py-2">Assessment</th>
                      <th className="px-3 py-2">Overall</th>
                      <th className="px-3 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previousSits.map((sit) => {
                      const sitPct = assessmentOverallPct(sit);
                      const sitTitle = sit.assessmentTitle?.trim() || "FE Project";
                      return (
                        <tr
                          key={`${sit.organisationAssessmentId}-${sit.assessmentStartDatetime ?? ""}`}
                          className="border-b border-[rgba(245,159,0,0.08)] last:border-b-0"
                        >
                          <td className="px-3 py-2.5 font-medium text-ink">
                            {getExamDateLabelForAssessment(sit)}
                          </td>
                          <td className="px-3 py-2.5 text-[#6e6a8a]">{sitTitle}</td>
                          <td className="px-3 py-2.5 text-[#6e6a8a]">
                            {Math.round(sit.overallScore)}/{Math.round(sit.overallMax)} ({sitPct}%)
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
      </div>
    </div>
  );
}
