/**
 * Frontend mirror of API `l1StageAccessMatrix` vocabulary.
 * Keep stage keys identical so Access grants + future BQ matrix stay aligned.
 *
 * Future BQ row (ops reference):
 * user id | payment status | YOG | Online Assessments | FE project | AI Mock | Human interview
 * each stage: Not Attempted | Qualified | Not Qualified
 */

export const L1_ACCESS_STAGES = [
  "online_assessment",
  "fe_project",
  "ai_mock",
  "human_interview",
] as const;

export type L1AccessStage = (typeof L1_ACCESS_STAGES)[number];

export const L1_ACCESS_STAGE_LABELS: Record<L1AccessStage, string> = {
  online_assessment: "L1 Hustler Online Assessment",
  fe_project: "FE Project",
  ai_mock: "AI Mock Interview",
  human_interview: "Human Interview",
};

export const L1_STAGE_OUTCOMES = [
  "not_attempted",
  "qualified",
  "not_qualified",
] as const;

export type L1StageOutcome = (typeof L1_STAGE_OUTCOMES)[number];

export const L1_STAGE_OUTCOME_LABELS: Record<L1StageOutcome, string> = {
  not_attempted: "Not Attempted",
  qualified: "Qualified",
  not_qualified: "Not Qualified",
};

export type L1PaymentStatus = "paid" | "unpaid";

/** Placeholder for when BQ matrix is synced — UI can swap to this without renaming stages. */
export type L1StageAccessMatrixRow = {
  academyUserId: string;
  paymentStatus: L1PaymentStatus;
  yearOfGraduation: number | null;
  stages: Record<L1AccessStage, L1StageOutcome>;
};
