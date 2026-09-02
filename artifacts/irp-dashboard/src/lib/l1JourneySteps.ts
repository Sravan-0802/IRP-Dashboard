import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getPhase } from "@/lib/journey";
import {
  clearedL1ViaC2,
  getAssessmentStepStatus,
  hasAttemptedFeProject,
  hasAttemptedL1Cycle2,
  hasClearedAssessment,
  hasClearedFeProject,
} from "@/lib/assessment";
import type { JourneyStep } from "@/components/irp/ui";
import {
  hasNxtmockAttempt,
  isNxtmockCleared,
  type NxtmockInterview,
} from "@/lib/nxtmockInterview";
import { isJuly26BookingTestUser } from "@/lib/july26BookingTestUsers";

const L1_STEPS: Omit<JourneyStep, "status">[] = [
  { label: "Online Assessment", icon: "assessment" },
  { label: "FE Project", icon: "post" },
  { label: "NxtMock AI Interview", icon: "mock" },
  { label: "Human Interview", icon: "human" },
  { label: "Level 2 Access", icon: "access" },
];

/** Level 1 · The Hustler — full pipeline through Level 2 access.
 * Score cards can stay hidden until admin releases a stage, but journey
 * advancement (FE cleared → AI Mock unlocked) always follows clearance ≥18.
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
  feProjectMinScore?: number | null,
  userId?: string | null,
): JourneyStep[] {
  const showOnline = visibility?.onlineL1Results !== false;
  const showAi = visibility?.aiMockResults === true;
  const showHuman = visibility?.humanInterviewResults === true;

  const forceOnlineBookingTrack =
    isJuly26BookingTestUser(userId) && !hasClearedAssessment(assessments, 1);
  const assessmentStatus = forceOnlineBookingTrack
    ? "active"
    : getAssessmentStepStatus(assessments, 1);
  const phase = getPhase(journey.journeyState);
  const state = journey.journeyState;
  const assessmentCleared = forceOnlineBookingTrack
    ? false
    : hasClearedAssessment(assessments, 1);
  const feCleared = forceOnlineBookingTrack
    ? false
    : hasClearedFeProject(assessments, feProjectMinScore);
  const feAttemptedNotCleared =
    !forceOnlineBookingTrack && !feCleared && hasAttemptedFeProject(assessments);
  const advancedToL2 =
    state.startsWith("L2_") || state.startsWith("L3_") || phase === "PLACED";
  const nxtmockCleared = isNxtmockCleared(nxtmock);
  const nxtmockAttemptedNotCleared = hasNxtmockAttempt(nxtmock) && !nxtmockCleared;
  const pastAiMock = state === "L1_HUMAN_INTERVIEW" || advancedToL2 || nxtmockCleared;

  // Only hide Online Assessment cleared/not-cleared while July 12 / C2 results
  // are gated. Cycle 1 students who already scored ≥70% keep "Completed".
  const awaitingJuly12OnlineRelease =
    !showOnline &&
    assessmentStatus !== "active" &&
    hasAttemptedL1Cycle2(assessments) &&
    (!assessmentCleared || clearedL1ViaC2(assessments));

  const onlineStatus: JourneyStep["status"] =
    phase === "REATTEMPT_WAITING" || phase === "REATTEMPT_ACTIVE"
      ? "reattempt"
      : awaitingJuly12OnlineRelease
        ? "active"
        : assessmentStatus;

  // FE clearance always advances the pipeline. Attempted-not-cleared is always
  // shown so students see they already sat (full score cards may still be gated).
  let feProjectStatus: JourneyStep["status"] = "locked";
  if (feCleared) feProjectStatus = "done";
  else if (feAttemptedNotCleared) feProjectStatus = "attempted_not_cleared";
  else if (assessmentCleared || phase === "POST_ASSESSMENT") feProjectStatus = "active";

  let aiMockStatus: JourneyStep["status"] = "locked";
  if (showAi && pastAiMock) aiMockStatus = "done";
  else if (nxtmockAttemptedNotCleared) aiMockStatus = "attempted_not_cleared";
  else if (feCleared) aiMockStatus = "active";

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
      badgeLabel:
        onlineStatus === "done"
          ? "Qualified"
          : onlineStatus === "attempted_not_cleared"
            ? "Not qualified"
            : undefined,
    },
    {
      ...L1_STEPS[1],
      status: feProjectStatus,
      badgeLabel:
        feProjectStatus === "done"
          ? "Cleared"
          : feProjectStatus === "attempted_not_cleared"
            ? "Not cleared"
            : feProjectStatus === "active"
              ? "In progress"
              : undefined,
    },
    {
      ...L1_STEPS[2],
      status: aiMockStatus,
      badgeLabel:
        aiMockStatus === "done"
          ? "Cleared"
          : aiMockStatus === "attempted_not_cleared"
            ? "Not cleared"
            : aiMockStatus === "active"
              ? "In progress"
              : undefined,
    },
    {
      ...L1_STEPS[3],
      status: humanInterviewStatus,
      badgeLabel:
        humanInterviewStatus === "done"
          ? "Complete"
          : humanInterviewStatus === "active"
            ? "In progress"
            : undefined,
    },
    { ...L1_STEPS[4], status: level2AccessStatus },
  ];
}
