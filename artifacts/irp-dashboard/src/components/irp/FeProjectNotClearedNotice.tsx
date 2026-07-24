import { AlertTriangle } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { isCycle1Cleared } from "@/lib/l1StudentTrack";
import {
  assessmentOverallPct,
  feProjectClearScore,
  hasAttemptedFeProject,
  hasClearedFeProject,
  isFeProjectC2,
  pickFeProjectAssessment,
} from "@/lib/assessment";
import { isFeProjectC2CohortUser } from "@/lib/feProjectC2Cohort";
import {
  FE_PROJECT_C2_NOT_CLEARED_BODY,
  FE_PROJECT_C2_NOT_CLEARED_TITLE,
  FE_PROJECT_MAIN_II_NOT_CLEARED_BODY,
  FE_PROJECT_MAIN_II_NOT_CLEARED_TITLE,
  FE_PROJECT_NOT_CLEARED_EYEBROW,
} from "@/lib/feProjectConfig";
import { Pill } from "./ui";

/**
 * Shown for cleared-L1 students who attempted the FE Project but have not
 * cleared it yet. C2 / cohort clears at ≥18/20; Main II at 100%.
 */
export function FeProjectNotClearedNotice({
  journey,
  assessments,
  userId,
}: {
  journey: Journey;
  assessments: AssessmentResult[];
  userId?: string;
}) {
  const clearedL1 = isCycle1Cleared(assessments);
  const feCleared = hasClearedFeProject(assessments, userId);
  const feAttempted = hasAttemptedFeProject(assessments);

  if (!clearedL1 || feCleared || !feAttempted) return null;

  const fe = pickFeProjectAssessment(assessments, userId);
  const pct = fe ? assessmentOverallPct(fe) : 0;
  const score = fe?.overallScore ?? 0;
  const max = fe?.overallMax ?? 20;
  const requiredScore = fe ? feProjectClearScore(fe, userId) : 20;
  const useEighteen =
    (fe ? isFeProjectC2(fe) : false) || isFeProjectC2CohortUser(userId);

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
            {useEighteen ? FE_PROJECT_C2_NOT_CLEARED_TITLE : FE_PROJECT_MAIN_II_NOT_CLEARED_TITLE}
          </h3>
          <p className="mt-0.5 text-sm text-muted2">
            {useEighteen ? FE_PROJECT_C2_NOT_CLEARED_BODY : FE_PROJECT_MAIN_II_NOT_CLEARED_BODY}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone="amber">
              Your score · {score}/{max} ({pct}%)
            </Pill>
            <Pill tone="green">
              Required · {requiredScore}/{max}
              {useEighteen ? " (18+)" : " (100%)"}
            </Pill>
          </div>
        </div>
      </div>
    </div>
  );
}
