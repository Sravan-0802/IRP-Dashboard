import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getPhase } from "@/lib/journey";
import {
  getAssessmentStepStatus,
  hasAttemptedFeProject,
  hasClearedAssessment,
  hasClearedFeProject,
} from "@/lib/assessment";
import type { JourneyStep } from "@/components/irp/ui";
import {
  hasNxtmockAttempt,
  isNxtmockCleared,
  type NxtmockInterview,
} from "@/lib/nxtmockInterview";

const L1_STEPS: Omit<JourneyStep, "status">[] = [
  { label: "Online Assessment", icon: "assessment" },
  { label: "FE Project", icon: "post" },
  { label: "AI Mock Interview", icon: "mock" },
  { label: "Human Interview", icon: "human" },
  { label: "Level 2 Access", icon: "access" },
];

/** Level 1 · The Hustler — full pipeline through Level 2 access.
 * Result-stage statuses stay hidden until admin releases that stage.
 */
export function l1HustlerJourneySteps(
  journey: Journey,
  assessments: AssessmentResult[],
  nxtmock?: NxtmockInterview | null,
  visibility?: {
    onlineL1Results?: boolean;
    feProjectResults?: boolean;
    aiMockResults?: boolean;
    humanInterviewResults?: boolean;
  },
): JourneyStep[] {
  const showOnline = visibility?.onlineL1Results !== false;
  const showFe = visibility?.feProjectResults === true;
  const showAi = visibility?.aiMockResults === true;
  const showHuman = visibility?.humanInterviewResults === true;

  const assessmentStatus = getAssessmentStepStatus(assessments, 1);
  const phase = getPhase(journey.journeyState);
  const state = journey.journeyState;
  const assessmentCleared = hasClearedAssessment(assessments, 1);
  // FE clears only on a perfect score (20/20).
  const feCleared = hasClearedFeProject(assessments);
  const feAttemptedNotCleared = !feCleared && hasAttemptedFeProject(assessments);
  const advancedToL2 =
    state.startsWith("L2_") || state.startsWith("L3_") || phase === "PLACED";
  const nxtmockCleared = isNxtmockCleared(nxtmock);
  const nxtmockAttemptedNotCleared = hasNxtmockAttempt(nxtmock) && !nxtmockCleared;
  const pastAiMock = state === "L1_HUMAN_INTERVIEW" || advancedToL2 || nxtmockCleared;

  const onlineStatus: JourneyStep["status"] =
    phase === "REATTEMPT_WAITING" || phase === "REATTEMPT_ACTIVE"
      ? "reattempt"
      : !showOnline && assessmentStatus !== "active"
        ? "active"
        : assessmentStatus;

  let feProjectStatus: JourneyStep["status"] = "locked";
  if (showFe && feCleared) feProjectStatus = "done";
  else if (showFe && feAttemptedNotCleared) feProjectStatus = "attempted_not_cleared";
  else if (assessmentCleared || phase === "POST_ASSESSMENT") feProjectStatus = "active";

  let aiMockStatus: JourneyStep["status"] = "locked";
  if (showAi && pastAiMock) aiMockStatus = "done";
  else if (showAi && nxtmockAttemptedNotCleared) aiMockStatus = "attempted_not_cleared";
  else if (showFe && feCleared) aiMockStatus = "active";

  let humanInterviewStatus: JourneyStep["status"] = "locked";
  if (showHuman && (phase === "PLACED" || state.startsWith("L3_"))) humanInterviewStatus = "done";
  else if (showHuman && showAi && pastAiMock) humanInterviewStatus = "active";

  let level2AccessStatus: JourneyStep["status"] = "locked";
  if (phase === "PLACED") level2AccessStatus = "done";
  else if (advancedToL2) level2AccessStatus = "active";

  if (phase === "PLACED") {
    return L1_STEPS.map((step) => ({
      ...step,
      status:
        step.label === "Online Assessment" && assessmentStatus === "active"
          ? "attempted_not_cleared"
          : "done",
    }));
  }

  return [
    {
      ...L1_STEPS[0],
      status: onlineStatus,
    },
    {
      ...L1_STEPS[1],
      status: feProjectStatus,
      ...(feProjectStatus === "active" ? { badgeLabel: "In progress" } : {}),
    },
    { ...L1_STEPS[2], status: aiMockStatus },
    { ...L1_STEPS[3], status: humanInterviewStatus },
    { ...L1_STEPS[4], status: level2AccessStatus },
  ];
}
