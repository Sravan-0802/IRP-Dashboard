/**
 * Single entry point for everything the dashboard reads out of BigQuery's
 * `academy_users_basic_details_for_pocs` (mirrored into
 * `academy_user_basic_details`):
 *
 *   - access gate       → must be paid AND IRP-eligible (both required)
 *   - payment           → `payment_status`
 *   - IRP eligibility   → `irp_eligible_status` (must be ELIGIBLE)
 *   - display name      → `name_on_certificate`
 *   - year of graduation→ `yog`
 *   - avatar            → `profile_pic_url`
 *
 * This table is the only reference for the paid vs unpaid dashboard split.
 * Do not read the legacy `unpaid_users` table for that decision.
 */
import { db, academyUserBasicDetailsTable, pool, type AcademyUserBasicDetails } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Values actually present in `payment_status` (measured over 45,195 rows):
 *
 *   YET_TO_PAY     17,360   almost entirely NBFC — loan disbursed, installments running
 *   UNPAID         14,550   all NOT_ELIGIBLE for IRP
 *   PAID            8,547   paid in full (NA_COMPLETED) or FLEX in good standing
 *   <null>          4,154   mostly NOT_ELIGIBLE
 *   NOT_PRESENTED     329   all ELIGIBLE
 *   YET_TO_START      255   all ELIGIBLE, plan not started
 *
 * The documented `PARTIALLY_PAID` does not appear in the data, but is mapped
 * anyway in case it shows up later.
 */
export const PAYMENT_STATUSES = [
  "PAID",
  "UNPAID",
  "PARTIALLY_PAID",
  "YET_TO_PAY",
  "YET_TO_START",
  "NOT_PRESENTED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Payment statuses that fail the "has paid" half of the access gate.
 *
 * Only an explicit `UNPAID` / `PARTIALLY_PAID` fails payment. `YET_TO_PAY` is the
 * NBFC / instalment cohort whose access is already funded, so treating anything
 * other than full `PAID` as unpaid would lock out most of the program.
 */
const UNPAID_STATUSES: ReadonlySet<string> = new Set<PaymentStatus>(["UNPAID", "PARTIALLY_PAID"]);

/** `irp_eligible_status` must equal this for access. */
const ELIGIBLE = "ELIGIBLE";

/**
 * Normalizes a raw BigQuery `payment_status` cell to canonical upper-snake form
 * ("paid", "Yet To Pay", "yet-to-pay" → "PAID", "YET_TO_PAY"). Unrecognized
 * non-empty values are kept upper-cased so ops can spot new states in the data
 * instead of having them silently dropped.
 */
export function normalizePaymentStatusValue(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!cleaned) return null;
  if (cleaned === "NOT_PAID" || cleaned === "PAYMENT_UNPAID") return "UNPAID";
  if (cleaned === "PAYMENT_PAID" || cleaned === "FULLY_PAID") return "PAID";
  if (cleaned === "PARTIAL" || cleaned === "PARTIAL_PAID") return "PARTIALLY_PAID";
  return cleaned;
}

export function normalizeIrpEligibleStatus(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "_");
  return cleaned || null;
}

/** True when this `payment_status` passes the payment half of the access gate. */
export function isPaidPaymentStatus(raw: unknown): boolean {
  const status = normalizePaymentStatusValue(raw);
  if (status === null) return true;
  return !UNPAID_STATUSES.has(status);
}

/** True when `irp_eligible_status` is explicitly ELIGIBLE. */
export function isIrpEligibleStatus(raw: unknown): boolean {
  return normalizeIrpEligibleStatus(raw) === ELIGIBLE;
}

/**
 * Access requires both: paid (not UNPAID/PARTIALLY_PAID) AND IRP-eligible.
 * Keep this and `getAcademyUserPaymentAccess` in agreement.
 */
export function isPaidAcademyUser(row: {
  paymentStatus?: string | null;
  irpEligibleStatus?: string | null;
}): boolean {
  return isPaidPaymentStatus(row.paymentStatus) && isIrpEligibleStatus(row.irpEligibleStatus);
}

/** BigQuery sometimes stores encrypted tokens in name columns — not displayable. */
export function isLikelyDisplayName(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  const v = value.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return false;
  if (v.length > 24 && /^[A-Za-z0-9+/=]+$/.test(v) && !/\s/.test(v)) return false;
  return true;
}

/** Only http(s) URLs are safe to hand to an <img src>. */
export function sanitizeProfilePicUrl(raw: string | null | undefined): string {
  const url = raw?.trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : "";
}

const ENSURE_BASIC_DETAILS_COLUMNS_SQL = `
ALTER TABLE academy_user_basic_details
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS name_on_certificate text,
  ADD COLUMN IF NOT EXISTS yog integer,
  ADD COLUMN IF NOT EXISTS lpoad timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS payment_plan text,
  ADD COLUMN IF NOT EXISTS irp_eligible_status text,
  ADD COLUMN IF NOT EXISTS profile_pic_url text;
`;

let ensureColumnsPromise: Promise<void> | null = null;

/**
 * Prod can lag a schema publish, so add the POCs columns on first read rather
 * than 500-ing on `column does not exist`.
 */
export async function ensureAcademyUserBasicDetailsColumns(): Promise<void> {
  if (!ensureColumnsPromise) {
    ensureColumnsPromise = pool
      .query(ENSURE_BASIC_DETAILS_COLUMNS_SQL)
      .then(() => undefined)
      .catch((err) => {
        ensureColumnsPromise = null;
        throw err;
      });
  }
  await ensureColumnsPromise;
}

/** Returns this user's mirrored POCs row, or null when they are not in it yet. */
export async function getAcademyUserBasicDetails(
  userId: string,
): Promise<AcademyUserBasicDetails | null> {
  await ensureAcademyUserBasicDetailsColumns();
  const [row] = await db
    .select()
    .from(academyUserBasicDetailsTable)
    .where(eq(academyUserBasicDetailsTable.userId, userId))
    .limit(1);
  return row ?? null;
}

export type AcademyUserPaymentAccess = {
  paid: boolean;
  /** Canonical status, or null when the user has no row in the POCs mirror. */
  paymentStatus: string | null;
  paymentPlan: string | null;
  irpEligibleStatus: string | null;
};

/**
 * Resolves dashboard access from the POCs mirror. Access is granted only when
 * both are true:
 *   1. payment — not `UNPAID` / `PARTIALLY_PAID`
 *   2. IRP     — `irp_eligible_status` is exactly `ELIGIBLE`
 *
 * A user with no mirror row is treated as allowed — that only happens when the
 * BigQuery sync has not reached them yet, and locking a paying eligible student
 * out of their dashboard is worse than the reverse.
 */
export async function getAcademyUserPaymentAccess(
  userId: string,
): Promise<AcademyUserPaymentAccess> {
  const row = await getAcademyUserBasicDetails(userId);

  if (!row) {
    logger.warn({ userId }, "No academy_user_basic_details row; defaulting payment gate to paid");
    return { paid: true, paymentStatus: null, paymentPlan: null, irpEligibleStatus: null };
  }

  const paymentStatus = normalizePaymentStatusValue(row.paymentStatus);
  const irpEligibleStatus = normalizeIrpEligibleStatus(row.irpEligibleStatus);

  return {
    paid: isPaidPaymentStatus(paymentStatus) && isIrpEligibleStatus(irpEligibleStatus),
    paymentStatus,
    paymentPlan: row.paymentPlan ?? null,
    irpEligibleStatus,
  };
}

/** Display name, in order: name_on_certificate → first + last → user_name. */
export function resolveAcademyUserDisplayName(
  row: Pick<
    AcademyUserBasicDetails,
    "nameOnCertificate" | "firstName" | "lastName" | "userName"
  > | null,
): string | null {
  if (!row) return null;

  if (isLikelyDisplayName(row.nameOnCertificate)) return row.nameOnCertificate.trim();

  const joined = [row.firstName?.trim(), row.lastName?.trim()]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  if (isLikelyDisplayName(joined)) return joined;

  if (isLikelyDisplayName(row.userName)) return row.userName.trim();
  return null;
}
