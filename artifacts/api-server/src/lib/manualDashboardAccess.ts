import { and, desc, eq, inArray } from "drizzle-orm";
import { db, academyUserBasicDetailsTable as people, academyUserAssessmentDetailsTable as assessments } from "@workspace/db";
import { MANUAL_DASHBOARD_ACCESS_GRANT_ID } from "./academyUserProfile";

export async function hasManualDashboardAccess(userId: string): Promise<boolean> {
  const rows = await db.select({ id: assessments.id }).from(assessments)
    .where(and(eq(assessments.userId, userId), eq(assessments.organisationAssessmentId, MANUAL_DASHBOARD_ACCESS_GRANT_ID))).limit(1);
  return rows.length > 0;
}

export async function grantManualDashboardAccess(userIds: string[]) {
  const ids = [...new Set(userIds.map(id => id.toLowerCase()))];
  return db.transaction(async tx => {
    // Enroll internal IDs without replacing any existing source statuses or identity.
    await tx.insert(people).values(ids.map(userId => ({ userId }))).onConflictDoNothing();
    const inserted = await tx.insert(assessments).values(ids.map(userId => ({
      userId,
      organisationAssessmentId: MANUAL_DASHBOARD_ACCESS_GRANT_ID,
      assessmentTitle: "Manual dashboard access",
    }))).onConflictDoNothing().returning({ userId: assessments.userId });
    return { requested: ids.length, granted: inserted.length, alreadyGranted: ids.length - inserted.length, userIds: ids };
  });
}

export async function revokeManualDashboardAccess(userIds: string[]) {
  const ids = [...new Set(userIds.map(id => id.toLowerCase()))];
  const removed = await db.delete(assessments).where(and(
    eq(assessments.organisationAssessmentId, MANUAL_DASHBOARD_ACCESS_GRANT_ID),
    inArray(assessments.userId, ids),
  )).returning({ userId: assessments.userId });
  return { requested: ids.length, revoked: removed.length, userIds: removed.map(row => row.userId) };
}

export async function listManualDashboardAccess() {
  const rows = await db.select({ userId: assessments.userId, grantedAt: assessments.syncedAt })
    .from(assessments).where(eq(assessments.organisationAssessmentId, MANUAL_DASHBOARD_ACCESS_GRANT_ID))
    .orderBy(desc(assessments.syncedAt), desc(assessments.id)).limit(100);
  return { grants: rows.map(row => ({ ...row, grantedAt: row.grantedAt.toISOString() })) };
}
