import { pool } from "@workspace/db";
import { DASHBOARD_ACCESS_OVERRIDE_ID, isDashboardStatusEligible } from "./academyUserProfile";
import { logger } from "./logger";

/**
 * History of dashboard access changes (No → Yes, Yes → No). Written by the daily
 * basic-details sync and by admin grants / removals. Logging never blocks the
 * caller: failures are logged and swallowed.
 */
const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS dashboard_access_changes (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  change text NOT NULL,
  from_access boolean,
  to_access boolean NOT NULL,
  old_irp_eligible_status text,
  new_irp_eligible_status text,
  old_lp_status text,
  new_lp_status text,
  old_product_status text,
  new_product_status text,
  source text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dashboard_access_changes_changed_at_idx ON dashboard_access_changes (changed_at);
CREATE INDEX IF NOT EXISTS dashboard_access_changes_user_id_idx ON dashboard_access_changes (user_id);
`;

let ensurePromise: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = pool
      .query(ENSURE_SQL)
      .then(() => undefined)
      .catch((err) => {
        ensurePromise = null;
        throw err;
      });
  }
  return ensurePromise;
}

export type AccessStatuses = {
  irpEligibleStatus: string | null;
  lpStatus: string | null;
  productStatus: string | null;
};

export type AccessChangeSource = "daily_sync" | "admin_grant" | "admin_revoke";

export type AccessChange = {
  userId: string;
  fromAccess: boolean | null;
  toAccess: boolean;
  before: AccessStatuses | null;
  after: AccessStatuses;
  source: AccessChangeSource;
};

/** NEW_USER_* is a student seen for the first time; the rest are real flips. */
function changeLabel(fromAccess: boolean | null, toAccess: boolean): string {
  if (fromAccess === null) return toAccess ? "NEW_USER_YES" : "NEW_USER_NO";
  return toAccess ? "NO_TO_YES" : "YES_TO_NO";
}

export type AccessSnapshot = {
  statuses: Map<string, AccessStatuses>;
  overrides: Set<string>;
};

/** Current mirror statuses and admin override grants, read before a sync overwrites them. */
export async function loadAccessSnapshot(): Promise<AccessSnapshot> {
  const [basic, override] = await Promise.all([
    pool.query<{ user_id: string; irp_eligible_status: string | null; lp_status: string | null; product_status: string | null }>(
      "SELECT user_id, irp_eligible_status, lp_status, product_status FROM academy_user_basic_details",
    ),
    pool.query<{ user_id: string }>(
      "SELECT DISTINCT user_id FROM academy_user_assessment_details WHERE organisation_assessment_id = $1",
      [DASHBOARD_ACCESS_OVERRIDE_ID],
    ),
  ]);
  const statuses = new Map<string, AccessStatuses>();
  for (const row of basic.rows) {
    statuses.set(row.user_id, {
      irpEligibleStatus: row.irp_eligible_status,
      lpStatus: row.lp_status,
      productStatus: row.product_status,
    });
  }
  return { statuses, overrides: new Set(override.rows.map((row) => row.user_id)) };
}

export function hasDashboardAccess(statuses: AccessStatuses | null | undefined, adminOverride: boolean): boolean {
  if (adminOverride) return true;
  return statuses ? isDashboardStatusEligible(statuses) : false;
}

/** Access changes caused by a sync that replaced `snapshot` statuses with `incoming`. */
export function diffSyncedAccess(
  snapshot: AccessSnapshot,
  incoming: Array<{ userId: string } & AccessStatuses>,
): AccessChange[] {
  const changes: AccessChange[] = [];
  for (const row of incoming) {
    const before = snapshot.statuses.get(row.userId) ?? null;
    const override = snapshot.overrides.has(row.userId);
    const after: AccessStatuses = {
      irpEligibleStatus: row.irpEligibleStatus,
      lpStatus: row.lpStatus,
      productStatus: row.productStatus,
    };
    const fromAccess = before ? hasDashboardAccess(before, override) : null;
    const toAccess = hasDashboardAccess(after, override);
    if (fromAccess === toAccess) continue;
    changes.push({ userId: row.userId, fromAccess, toAccess, before, after, source: "daily_sync" });
  }
  return changes;
}

const INSERT_BATCH = 500;
const COLUMNS = 12;

export async function recordAccessChanges(changes: AccessChange[]): Promise<void> {
  if (changes.length === 0) return;
  try {
    await ensureTable();
    for (let i = 0; i < changes.length; i += INSERT_BATCH) {
      const batch = changes.slice(i, i + INSERT_BATCH);
      const values: unknown[] = [];
      const placeholders = batch.map((change, index) => {
        values.push(
          change.userId,
          changeLabel(change.fromAccess, change.toAccess),
          change.fromAccess,
          change.toAccess,
          change.before?.irpEligibleStatus ?? null,
          change.after.irpEligibleStatus,
          change.before?.lpStatus ?? null,
          change.after.lpStatus,
          change.before?.productStatus ?? null,
          change.after.productStatus,
          change.source,
          new Date(),
        );
        const base = index * COLUMNS;
        return `(${Array.from({ length: COLUMNS }, (_, k) => `$${base + k + 1}`).join(", ")})`;
      });
      await pool.query(
        `INSERT INTO dashboard_access_changes
          (user_id, change, from_access, to_access,
           old_irp_eligible_status, new_irp_eligible_status,
           old_lp_status, new_lp_status,
           old_product_status, new_product_status,
           source, changed_at)
         VALUES ${placeholders.join(", ")}`,
        values,
      );
    }
    logger.info({ count: changes.length, source: changes[0]?.source }, "Recorded dashboard access changes");
  } catch (err) {
    logger.warn({ err, count: changes.length }, "Failed to record dashboard access changes");
  }
}
