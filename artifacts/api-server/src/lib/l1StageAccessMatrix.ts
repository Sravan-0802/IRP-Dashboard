/**
 * Canonical L1 stage access matrix — shared vocabulary for:
 * 1. Admin access grants (who gets the link) — live today
 * 2. Future BigQuery user matrix (payment + per-stage outcome) — planned
 *
 * Expected BQ-shaped row (illustrative):
 * | user id        | payment status | year of graduation | Online Assessments      | FE project         | AI Mock Interview   | Human interview         |
 * | 21I3USERTEST   | PAID / UNPAID  | 2025               | Assessment Not Attempted / Qualified / Not Qualified | … | … | … |
 *
 * Do not invent alternate stage keys elsewhere — extend this module instead.
 */

export const L1_ACCESS_STAGES = [
  "online_assessment",
  "fe_project",
  "ai_mock",
  "human_interview",
] as const;

export type L1AccessStage = (typeof L1_ACCESS_STAGES)[number];

/** Human labels matching ops / BQ column headers. */
export const L1_ACCESS_STAGE_LABELS: Record<L1AccessStage, string> = {
  online_assessment: "Online Assessment",
  fe_project: "FE Project",
  ai_mock: "AI Mock Interview",
  human_interview: "Human Interview",
};

/**
 * Per-stage attempt outcome from the future BQ matrix.
 * Maps labels like "Assessment Qualified", "FE Not Attempted", etc.
 */
export const L1_STAGE_OUTCOMES = [
  "not_attempted",
  "qualified",
  "not_qualified",
] as const;

export type L1StageOutcome = (typeof L1_STAGE_OUTCOMES)[number];

export const L1_PAYMENT_STATUSES = ["paid", "unpaid"] as const;
export type L1PaymentStatus = (typeof L1_PAYMENT_STATUSES)[number];

/** Future synced row shape — one row per academy user from BQ. */
export type L1StageAccessMatrixRow = {
  academyUserId: string;
  paymentStatus: L1PaymentStatus;
  yearOfGraduation: number | null;
  stages: Record<L1AccessStage, L1StageOutcome>;
};

/**
 * Normalize free-text / BQ cell values into a stage outcome.
 * Accepts: "Assessment Qualified", "FE Not Attempted", "Mock Not Qualified",
 * "Interview Qualified", "qualified", "NOT_ATTEMPTED", etc.
 */
export function parseL1StageOutcome(raw: string | null | undefined): L1StageOutcome | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!s) return null;
  if (/\bnot\s*attempt/.test(s) || s === "na" || s === "pending") return "not_attempted";
  if (/\bnot\s*qualif/.test(s) || /\bfail/.test(s) || s === "cleared:false") return "not_qualified";
  if (/\bqualif/.test(s) || /\bcleared\b/.test(s) || s === "pass") return "qualified";
  if (s === "not_attempted" || s === "qualified" || s === "not_qualified") {
    return s as L1StageOutcome;
  }
  return null;
}

export function parseL1PaymentStatus(raw: string | null | undefined): L1PaymentStatus | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "paid" || s === "payment_paid") return "paid";
  if (s === "unpaid" || s === "not_paid" || s === "payment_unpaid") return "unpaid";
  return null;
}

/**
 * How layers compose (today vs later):
 *
 * | Concern              | Today                                      | Future (BQ matrix)                          |
 * |----------------------|--------------------------------------------|---------------------------------------------|
 * | Payment gate         | `unpaid_users` table                       | `paymentStatus` from BQ matrix              |
 * | Who sees stage URL   | `access_batches` CSV grants                | Grant OR auto-eligibility from matrix rules |
 * | Stage progress/UI    | assessments / nxtmock sync                 | `stages.*.outcome` from BQ (+ existing sync)|
 *
 * Access grants remain the operator override for URLs (mock/main).
 * BQ matrix will drive cohort eligibility and Qualified / Not Qualified display.
 * Prefer reading outcomes through helpers here so UI/API stay swappable.
 */
export function emptyStageOutcomes(): Record<L1AccessStage, L1StageOutcome> {
  return {
    online_assessment: "not_attempted",
    fe_project: "not_attempted",
    ai_mock: "not_attempted",
    human_interview: "not_attempted",
  };
}

export function isL1AccessStage(v: string): v is L1AccessStage {
  return (L1_ACCESS_STAGES as readonly string[]).includes(v);
}
