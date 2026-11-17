/**
 * Pure rules for reading a student's stage results from the new irp_v2 tables
 * (expand–contract step 5: switch reads behind a flag). No database access here, so it is unit-testable.
 */
export const TRACK_STAGE_STATUSES = [
  "NOT_ATTEMPTED",
  "ACTIVE",
  "RESULT_PENDING",
  "QUALIFIED",
  "NOT_QUALIFIED",
] as const;
export type TrackStageStatus = (typeof TRACK_STAGE_STATUSES)[number];

export type MernTrackStatus = {
  onlineAssessment: TrackStageStatus;
  feProject: TrackStageStatus;
  /** null while the admin has not released Human Interview results. */
  humanInterview: TrackStageStatus | null;
  calculatedAt: string | null;
};

export type LegacyReason =
  | "disabled"
  | "no_refresh_logged"
  | "refresh_checks_failed"
  | "refresh_stale"
  | "no_row_for_student"
  | "unavailable";

export type TrackStatusResponse =
  | { source: "irp_v2"; mern: MernTrackStatus }
  | { source: "legacy"; mern: null; reason: LegacyReason };

/** One row of the read query: the latest refresh run joined to the student's track row. */
export type TrackStatusRow = {
  refresh_status: string | null;
  refresh_finished_at: Date | string | null;
  hustler_assessment_status: string | null;
  fe_project_status: string | null;
  human_interview_status: string | null;
  calculated_at: Date | string | null;
};

/** The new tables are refilled once a day; older than this means the daily refresh stopped. */
export const MAX_REFRESH_AGE_MS = 36 * 60 * 60 * 1000;

export const legacy = (reason: LegacyReason): TrackStatusResponse => ({
  source: "legacy",
  mern: null,
  reason,
});

function asStatus(value: string | null): TrackStageStatus | null {
  return (TRACK_STAGE_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as TrackStageStatus)
    : null;
}

function toIso(value: Date | string | null): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Decide what the student gets. The new tables are used only when the latest refresh passed every
 * old-vs-new check and is recent; in every other case the caller keeps the old logic.
 */
export function toTrackStatusResponse(
  row: TrackStatusRow | undefined,
  opts: { humanInterviewReleased: boolean; now: number },
): TrackStatusResponse {
  if (!row || row.refresh_status == null) return legacy("no_refresh_logged");
  if (row.refresh_status !== "success") return legacy("refresh_checks_failed");
  const finishedAt = toIso(row.refresh_finished_at);
  if (!finishedAt || opts.now - new Date(finishedAt).getTime() > MAX_REFRESH_AGE_MS) {
    return legacy("refresh_stale");
  }
  const onlineAssessment = asStatus(row.hustler_assessment_status);
  const feProject = asStatus(row.fe_project_status);
  const humanInterview = asStatus(row.human_interview_status);
  if (!onlineAssessment || !feProject || !humanInterview) return legacy("no_row_for_student");
  return {
    source: "irp_v2",
    mern: {
      onlineAssessment,
      feProject,
      humanInterview: opts.humanInterviewReleased ? humanInterview : null,
      calculatedAt: toIso(row.calculated_at),
    },
  };
}
