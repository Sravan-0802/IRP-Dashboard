import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getPhase } from "@/lib/journey";
import {
  hasAttemptedFeProject,
  hasClearedFeProject,
} from "@/lib/assessment";
import { isCycle1Cleared } from "@/lib/l1StudentTrack";
import {
  hasNxtmockAttempt,
  isNxtmockCleared,
  type NxtmockInterview,
} from "@/lib/nxtmockInterview";

export type L1PipelineStage =
  | "fe_project_active"
  | "fe_project_not_cleared"
  | "ai_mock_active"
  | "ai_mock_not_cleared"
  | "human_interview_active"
  | "level_2_access";

/** Current post-L1 pipeline step for hero copy and styling. */
export function getL1PipelineStage(
  journey: Journey,
  assessments: AssessmentResult[],
  nxtmock?: NxtmockInterview | null,
  feProjectMinScore?: number | null,
): L1PipelineStage | null {
  if (!isCycle1Cleared(assessments)) return null;

  const phase = getPhase(journey.journeyState);
  const state = journey.journeyState;
  const feCleared = hasClearedFeProject(assessments, feProjectMinScore);
  const feAttempted = hasAttemptedFeProject(assessments);
  const nxtmockCleared = isNxtmockCleared(nxtmock);
  const nxtmockAttempted = hasNxtmockAttempt(nxtmock);
  const advancedToL2 =
    state.startsWith("L2_") || state.startsWith("L3_") || phase === "PLACED";

  if (advancedToL2) return "level_2_access";
  if (nxtmockCleared || state === "L1_HUMAN_INTERVIEW") return "human_interview_active";
  if (!feCleared && feAttempted) return "fe_project_not_cleared";
  if (nxtmockAttempted) return "ai_mock_not_cleared";
  if (feCleared) return "ai_mock_active";
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
        body: "You qualified in the L1 online assessment. Score ≥18/20 on the FE Project to unlock the AI Mock Interview.",
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
    case "ai_mock_active":
      return {
        eyebrow: "NxtMock AI Interview · Next step",
        title: "Take your NxtMock AI Interview",
        body: "You cleared the FE Project. Complete the NxtMock AI Interview to move forward in your IRP journey.",
        statusBadge: "FE · Cleared",
        dotColor: "#6741d9",
        eyebrowClass: "border-[rgba(103,65,217,0.2)] text-brand",
        borderClass: "border-[rgba(103,65,217,0.18)]",
        background: "linear-gradient(130deg, #ede9fe, #f8f7ff)",
      };
    case "ai_mock_not_cleared":
      return {
        eyebrow: "NxtMock AI Interview · Not cleared",
        title: "Keep preparing — re-attempt coming soon",
        body: "You attempted the NxtMock AI Interview but have not cleared yet. Stay tuned to your dashboard for the next step.",
        statusBadge: "AI Mock · Not cleared",
        dotColor: "#f59f00",
        eyebrowClass: "border-[rgba(245,159,0,0.35)] text-[#e67700]",
        borderClass: "border-[rgba(245,159,0,0.28)]",
        background: "linear-gradient(130deg, #fff9db, #fff5f5)",
      };
    case "human_interview_active":
      return {
        eyebrow: "Human Interview · In progress",
        title: "Prepare for your Human Interview",
        body: "You cleared the AI Mock Interview. Your Human Interview is the next step toward Level 2 access.",
        statusBadge: "AI Mock · Cleared",
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
