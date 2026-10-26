import type { HumanInterviewResults } from "@workspace/api-client-react";
import type { JourneyStep } from "@/components/irp/ui";

/** Reflect released clearance without changing journey state or unlocking Level 2. */
export function withHumanInterviewClearance(
  steps: JourneyStep[],
  results: HumanInterviewResults | undefined,
): JourneyStep[] {
  const latest = results?.released ? results.latestResult : null;
  if (!latest || latest.finalScore === null ||
      !["Cleared", "Not Cleared"].includes(latest.clearanceStatus)) return steps;
  const cleared = latest.clearanceStatus === "Cleared";
  return steps.map((step) => step.label === "Human Interview" ? {
    ...step,
    status: cleared ? "done" : "attempted_not_cleared",
    badgeLabel: cleared ? "Cleared" : "Not cleared",
  } : step);
}
