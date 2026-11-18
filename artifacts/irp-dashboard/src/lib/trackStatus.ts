import type { JourneyStep } from "@/components/irp/ui";

/**
 * A student's stage results as stored in the new irp_v2 tables (served by /api/student/track-status).
 * When the server answers `source: "legacy"` (switch off, or the new tables are not usable right now)
 * the dashboard keeps working results out the old way, so `parseTrackStatus` returns null.
 */
const STATUSES = [
  "NOT_ATTEMPTED",
  "ACTIVE",
  "RESULT_PENDING",
  "QUALIFIED",
  "NOT_QUALIFIED",
] as const;
export type TrackStageStatus = (typeof STATUSES)[number];

export type MernTrackStatus = {
  onlineAssessment: TrackStageStatus;
  feProject: TrackStageStatus;
  /** null while the admin has not released Human Interview results. */
  humanInterview: TrackStageStatus | null;
};

function asStatus(value: unknown): TrackStageStatus | null {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value)
    ? (value as TrackStageStatus)
    : null;
}

/** null means "use the old logic": anything but a complete, well-formed irp_v2 answer. */
export function parseTrackStatus(body: unknown): MernTrackStatus | null {
  if (!body || typeof body !== "object") return null;
  const { source, mern } = body as { source?: unknown; mern?: unknown };
  if (source !== "irp_v2" || !mern || typeof mern !== "object") return null;
  const row = mern as Record<string, unknown>;
  const onlineAssessment = asStatus(row.onlineAssessment);
  const feProject = asStatus(row.feProject);
  if (!onlineAssessment || !feProject) return null;
  return {
    onlineAssessment,
    feProject,
    humanInterview: row.humanInterview == null ? null : asStatus(row.humanInterview),
  };
}

/** Online Assessment step status from the stored result (same three values as the old logic). */
export function trackOnlineStepStatus(
  track: MernTrackStatus,
): "done" | "attempted_not_cleared" | "active" {
  if (track.onlineAssessment === "QUALIFIED") return "done";
  if (track.onlineAssessment === "NOT_QUALIFIED") return "attempted_not_cleared";
  return "active";
}

/** Stored Human Interview result on the journey card; mirrors withHumanInterviewClearance. */
export function withTrackHumanInterview(
  steps: JourneyStep[],
  track: MernTrackStatus,
): JourneyStep[] {
  const result = track.humanInterview;
  if (result !== "QUALIFIED" && result !== "NOT_QUALIFIED") return steps;
  const cleared = result === "QUALIFIED";
  return steps.map((step) =>
    step.label === "Human Interview"
      ? {
          ...step,
          status: cleared ? "done" : "attempted_not_cleared",
          badgeLabel: cleared ? "Cleared" : "Not cleared",
        }
      : step,
  );
}
