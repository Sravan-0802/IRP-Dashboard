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
import { isJuly26BookingTestUser } from "@/lib/july26BookingTestUsers";
import { trackOnlineStepStatus, type MernTrackStatus } from "@/lib/trackStatus";

/** L1 cycle without NxtMock AI Interview — FE cleared unlocks Human Interview. */
const L1_STEPS: Omit<JourneyStep, "status">[] = [
  { label: "Online Assessment", icon: "assessment" },
  { label: "FE Project", icon: "post" },
  { label: "Human Interview", icon: "human" },
  { label: "Level 2 Access", icon: "access" },
];

/** Level 1 · The Hustler — pipeline through Level 2 access (AI Mock removed). */
export function l1HustlerJourneySteps(
  journey: Journey,
  assessments: AssessmentResult[],
  _nxtmock?: unknown,
  visibility?: {
    onlineL1Results?: boolean;
    feProjectResults?: boolean;
    aiMockResults?: boolean;
    humanInterviewResults?: boolean;
  },
  feProjectMinScore?: number | null,
  userId?: string | null,
  /**
   * Stored results from the new irp_v2 tables. When given, they decide qualified / not qualified
   * for Online Assessment and FE Project instead of the raw assessment rows; journey and
   * visibility rules below are unchanged. Null or omitted = the old logic.
   */
  track?: MernTrackStatus | null,
): JourneyStep[] {
  const showOnline = visibility?.onlineL1Results !== false;
  const showHuman = visibility?.humanInterviewResults === true;

  const onlineCleared = track
    ? track.onlineAssessment === "QUALIFIED"
    : hasClearedAssessment(assessments, 1);
  const forceOnlineBookingTrack = isJuly26BookingTestUser(userId) && !onlineCleared;
  const assessmentStatus = forceOnlineBookingTrack
    ? "active"
    : track
      ? trackOnlineStepStatus(track)
      : getAssessmentStepStatus(assessments, 1);
  const phase = getPhase(journey.journeyState);
  const state = journey.journeyState;
  const assessmentCleared = forceOnlineBookingTrack ? false : onlineCleared;
  const feCleared = forceOnlineBookingTrack
    ? false
    : track
      ? track.feProject === "QUALIFIED"
      : hasClearedFeProject(assessments, feProjectMinScore);
  const feAttemptedNotCleared =
    !forceOnlineBookingTrack &&
    !feCleared &&
    (track ? track.feProject === "NOT_QUALIFIED" : hasAttemptedFeProject(assessments));
  const advancedToL2 =
    state.startsWith("L2_") || state.startsWith("L3_") || phase === "PLACED";

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

  let feProjectStatus: JourneyStep["status"] = "locked";
  if (feCleared) feProjectStatus = "done";
  else if (feAttemptedNotCleared) feProjectStatus = "attempted_not_cleared";
  else if (assessmentCleared || phase === "POST_ASSESSMENT") feProjectStatus = "active";

  let humanInterviewStatus: JourneyStep["status"] = "locked";
  if (showHuman && (phase === "PLACED" || state.startsWith("L3_"))) humanInterviewStatus = "done";
  else if (feCleared || state === "L1_HUMAN_INTERVIEW") {
    humanInterviewStatus = "active";
  }

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
      status: humanInterviewStatus,
      badgeLabel:
        humanInterviewStatus === "done"
          ? "Complete"
          : humanInterviewStatus === "active"
            ? "In progress"
            : undefined,
    },
    { ...L1_STEPS[3], status: level2AccessStatus },
  ];
}
