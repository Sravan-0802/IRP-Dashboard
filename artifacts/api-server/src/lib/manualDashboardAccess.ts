import {
  db,
  academyUserAssessmentDetailsTable,
  academyUserBasicDetailsTable,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { DASHBOARD_ACCESS_OVERRIDE_ID } from "./academyUserProfile";
import { hasDashboardAccess, recordAccessChanges, type AccessChange } from "./dashboardAccessLog";
import { logger } from "./logger";

function uniqueUserIds(raw: string[]): string[] {
  return [...new Set(raw.map((id) => id.trim()).filter(Boolean))];
}

/** Logs admin grants / removals that actually flip a student's access. */
async function logAdminAccessChanges(userIds: string[], source: "admin_grant" | "admin_revoke") {
  if (userIds.length === 0) return;
  try {
    const rows = await db
      .select({
        userId: academyUserBasicDetailsTable.userId,
        irpEligibleStatus: academyUserBasicDetailsTable.irpEligibleStatus,
        lpStatus: academyUserBasicDetailsTable.lpStatus,
        productStatus: academyUserBasicDetailsTable.productStatus,
      })
      .from(academyUserBasicDetailsTable)
      .where(inArray(academyUserBasicDetailsTable.userId, userIds));
    const byId = new Map(rows.map((row) => [row.userId, row]));
    const changes: AccessChange[] = [];
    for (const userId of userIds) {
      const row = byId.get(userId);
      const statuses = {
        irpEligibleStatus: row?.irpEligibleStatus ?? null,
        lpStatus: row?.lpStatus ?? null,
        productStatus: row?.productStatus ?? null,
      };
      if (hasDashboardAccess(statuses, false)) continue;
      changes.push({
        userId,
        fromAccess: source === "admin_revoke",
        toAccess: source === "admin_grant",
        before: statuses,
        after: statuses,
        source,
      });
    }
    await recordAccessChanges(changes);
  } catch (err) {
    logger.warn({ err, source }, "Failed to log admin dashboard access changes");
  }
}

export async function hasManualDashboardAccessGrant(userId: string): Promise<boolean> {
  const academyUserId = userId.trim();
  if (!academyUserId) return false;
  const [row] = await db
    .select({ id: academyUserAssessmentDetailsTable.id })
    .from(academyUserAssessmentDetailsTable)
    .where(
      and(
        eq(academyUserAssessmentDetailsTable.userId, academyUserId),
        eq(academyUserAssessmentDetailsTable.organisationAssessmentId, DASHBOARD_ACCESS_OVERRIDE_ID),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function listManualDashboardAccessGrants(limit = 200) {
  const rows = await db
    .select({
      userId: academyUserAssessmentDetailsTable.userId,
      grantedAt: academyUserAssessmentDetailsTable.syncedAt,
    })
    .from(academyUserAssessmentDetailsTable)
    .where(eq(academyUserAssessmentDetailsTable.organisationAssessmentId, DASHBOARD_ACCESS_OVERRIDE_ID))
    .orderBy(desc(academyUserAssessmentDetailsTable.syncedAt))
    .limit(limit);
  return rows;
}

export async function grantManualDashboardAccess(rawIds: string[]) {
  const ids = uniqueUserIds(rawIds);
  if (ids.length === 0) {
    return { requested: 0, granted: 0, alreadyGranted: 0, userIds: [] as string[] };
  }

  const now = new Date();
  const existing = await db
    .select({ userId: academyUserAssessmentDetailsTable.userId })
    .from(academyUserAssessmentDetailsTable)
    .where(
      and(
        inArray(academyUserAssessmentDetailsTable.userId, ids),
        eq(academyUserAssessmentDetailsTable.organisationAssessmentId, DASHBOARD_ACCESS_OVERRIDE_ID),
      ),
    );
  const already = new Set(existing.map((row) => row.userId));
  const toInsert = ids.filter((id) => !already.has(id));

  await db
    .insert(academyUserBasicDetailsTable)
    .values(ids.map((userId) => ({ userId, syncedAt: now })))
    .onConflictDoNothing({ target: academyUserBasicDetailsTable.userId });

  let granted = 0;
  if (toInsert.length > 0) {
    const inserted = await db
      .insert(academyUserAssessmentDetailsTable)
      .values(
        toInsert.map((userId) => ({
          userId,
          organisationAssessmentId: DASHBOARD_ACCESS_OVERRIDE_ID,
          syncedAt: now,
        })),
      )
      .onConflictDoNothing()
      .returning({ userId: academyUserAssessmentDetailsTable.userId });
    granted = inserted.length;
    await logAdminAccessChanges(inserted.map((row) => row.userId), "admin_grant");
  }

  return {
    requested: ids.length,
    granted,
    alreadyGranted: already.size,
    userIds: ids,
  };
}

export async function revokeManualDashboardAccess(rawIds: string[]) {
  const ids = uniqueUserIds(rawIds);
  if (ids.length === 0) {
    return { requested: 0, removed: 0 };
  }

  const removed = await db
    .delete(academyUserAssessmentDetailsTable)
    .where(
      and(
        inArray(academyUserAssessmentDetailsTable.userId, ids),
        eq(academyUserAssessmentDetailsTable.organisationAssessmentId, DASHBOARD_ACCESS_OVERRIDE_ID),
      ),
    )
    .returning({ userId: academyUserAssessmentDetailsTable.userId });

  await logAdminAccessChanges([...new Set(removed.map((row) => row.userId))], "admin_revoke");
  return { requested: ids.length, removed: removed.length };
}
