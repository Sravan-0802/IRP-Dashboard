import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getPhase } from "@/lib/journey";
import {
  hasAttemptedFeProject,
  hasClearedFeProject,
} from "@/lib/assessment";
import { isCycle1Cleared } from "@/lib/l1StudentTrack";

export type L1PipelineStage =
  | "fe_project_active"
  | "fe_project_not_cleared"
  | "human_interview_active"
  | "level_2_access";

/** Current post-L1 pipeline step for hero copy and styling (AI Mock removed). */
export function getL1PipelineStage(
  journey: Journey,
  assessments: AssessmentResult[],
  _nxtmock?: unknown,
  feProjectMinScore?: number | null,
): L1PipelineStage | null {
  if (!isCycle1Cleared(assessments)) return null;

  const phase = getPhase(journey.journeyState);
  const state = journey.journeyState;
  const feCleared = hasClearedFeProject(assessments, feProjectMinScore);
  const feAttempted = hasAttemptedFeProject(assessments);
  const advancedToL2 =
    state.startsWith("L2_") || state.startsWith("L3_") || phase === "PLACED";

  if (advancedToL2) return "level_2_access";
  if (feCleared || state === "L1_HUMAN_INTERVIEW") return "human_interview_active";
  if (!feCleared && feAttempted) return "fe_project_not_cleared";
  return "fe_project_active";
}

export type L1StageHeroContent = {
  eyebrow: string;
  title: string;
  body: string;
  statusBadge: string;
  dotColor: string;
  eyebrowClass: string;
  borderClass: string;
  background: string;
};

export function l1StageHeroContent(stage: L1PipelineStage): L1StageHeroContent {
  switch (stage) {
    case "fe_project_active":
      return {
        eyebrow: "FE Project · In progress",
        title: "Complete your FE Project",
        body: "You qualified in the L1 online assessment. Score ≥18/20 on the FE Project to unlock the Human Interview.",
        statusBadge: "L1 · Qualified",
        dotColor: "#0ca678",
        eyebrowClass: "border-[rgba(12,166,120,0.3)] text-teal",
        borderClass: "border-[rgba(12,166,120,0.25)]",
        background: "linear-gradient(130deg, #e8faf0, #eef2ff)",
      };
    case "fe_project_not_cleared":
      return {
        eyebrow: "FE Project · Not cleared",
        title: "FE Project not cleared yet",
        body: "You qualified in the L1 online assessment. Your FE score is on the dashboard — a re-attempt link will appear when released. Score ≥18/20 to continue.",
        statusBadge: "FE · Not cleared",
        dotColor: "#f59f00",
        eyebrowClass: "border-[rgba(245,159,0,0.35)] text-[#e67700]",
        borderClass: "border-[rgba(245,159,0,0.28)]",
        background: "linear-gradient(130deg, #fff9db, #fff5f5)",
      };
    case "human_interview_active":
      return {
        eyebrow: "Human Interview · Next step",
        title: "Prepare for your Human Interview",
        body: "You cleared the FE Project. Your Human Interview is the next step toward Level 2 access.",
        statusBadge: "FE · Cleared",
        dotColor: "#3b5bdb",
        eyebrowClass: "border-[rgba(59,91,219,0.25)] text-[#3b5bdb]",
        borderClass: "border-[rgba(59,91,219,0.22)]",
        background: "linear-gradient(130deg, #edf2ff, #f8f7ff)",
      };
    case "level_2_access":
      return {
        eyebrow: "Level 2 · Unlocked",
        title: "You're advancing to Level 2",
        body: "You completed the Level 1 pipeline. Continue with Level 2 preparation on your dashboard.",
        statusBadge: "Level 1 · Complete",
        dotColor: "#0ca678",
        eyebrowClass: "border-[rgba(12,166,120,0.3)] text-teal",
        borderClass: "border-[rgba(12,166,120,0.25)]",
        background: "linear-gradient(130deg, #e8faf0, #f0fff8)",
      };
  }
}
