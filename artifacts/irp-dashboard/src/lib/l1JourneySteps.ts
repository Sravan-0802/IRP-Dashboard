import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getPhase } from "@/lib/journey";
import { getAssessmentStepStatus, hasClearedAssessment } from "@/lib/assessment";
import type { JourneyStep } from "@/components/irp/ui";

const L1_STEPS: Omit<JourneyStep, "status">[] = [
  { label: "Online Assessment", icon: "assessment" },
  { label: "FE Project", icon: "post" },
  { label: "AI Mock Interview", icon: "mock" },
  { label: "Human Interview", icon: "human" },
  { label: "Level 2 Access", icon: "access" },
];

/** Level 1 · The Hustler — full pipeline through Level 2 access. */
export function l1HustlerJourneySteps(
  journey: Journey,
  assessments: AssessmentResult[],
): JourneyStep[] {
  const assessmentStatus = getAssessmentStepStatus(assessments, 1);
  const phase = getPhase(journey.journeyState);
  const state = journey.journeyState;
  const assessmentCleared = hasClearedAssessment(assessments, 1);
  const feDone = journey.projectSubmitted;
  const advancedToL2 =
    state.startsWith("L2_") || state.startsWith("L3_") || phase === "PLACED";

  const onlineStatus: JourneyStep["status"] =
    phase === "REATTEMPT_WAITING" || phase === "REATTEMPT_ACTIVE"
      ? "reattempt"
      : assessmentStatus;

  let feProjectStatus: JourneyStep["status"] = "locked";
  if (feDone) feProjectStatus = "done";
  else if (assessmentCleared || phase === "POST_ASSESSMENT") feProjectStatus = "active";

  let aiMockStatus: JourneyStep["status"] = "locked";
  if (advancedToL2) aiMockStatus = "done";
  else if (feDone) aiMockStatus = "active";

  let humanInterviewStatus: JourneyStep["status"] = "locked";
  if (phase === "PLACED" || state.startsWith("L3_")) humanInterviewStatus = "done";
  else if (advancedToL2) humanInterviewStatus = "active";

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
    { ...L1_STEPS[0], status: onlineStatus },
    {
      ...L1_STEPS[1],
      status: feProjectStatus,
      ...(feProjectStatus === "active" ? { badgeLabel: "Unlocked" } : {}),
    },
    { ...L1_STEPS[2], status: aiMockStatus },
    { ...L1_STEPS[3], status: humanInterviewStatus },
    { ...L1_STEPS[4], status: level2AccessStatus },
  ];
}
