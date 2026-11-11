import {
  db,
  academyUserAssessmentDetailsTable,
  academyUserBasicDetailsTable,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { DASHBOARD_ACCESS_OVERRIDE_ID } from "./academyUserProfile";

function uniqueUserIds(raw: string[]): string[] {
  return [...new Set(raw.map((id) => id.trim()).filter(Boolean))];
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

  return { requested: ids.length, removed: removed.length };
}
