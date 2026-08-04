import { and, count, eq, or, isNull, gt, lte } from "drizzle-orm";
import {
  db,
  accessBatchesTable,
  accessBatchUsersTable,
} from "@workspace/db";
import {
  L1_ACCESS_STAGES,
  L1_ACCESS_STAGE_LABELS,
  isL1AccessStage,
  type L1AccessStage,
} from "./l1StageAccessMatrix";

/** @deprecated Prefer L1_ACCESS_STAGES — same values, kept for existing imports. */
export const ACCESS_STAGES = L1_ACCESS_STAGES;

export type AccessStage = L1AccessStage;

export const ACCESS_LINK_KINDS = ["mock", "main", "default"] as const;
export type AccessLinkKind = (typeof ACCESS_LINK_KINDS)[number];

export function isAccessStage(v: string): v is AccessStage {
  return isL1AccessStage(v);
}

export function isAccessLinkKind(v: string): v is AccessLinkKind {
  return (ACCESS_LINK_KINDS as readonly string[]).includes(v);
}

/** Online + FE require mock|main; AI/Human use default (or optional mock|main). */
export function normalizeLinkKind(stage: AccessStage, linkKind: string): AccessLinkKind | null {
  if (stage === "online_assessment" || stage === "fe_project") {
    if (linkKind === "mock" || linkKind === "main") return linkKind;
    return null;
  }
  if (linkKind === "mock" || linkKind === "main" || linkKind === "default") return linkKind;
  return "default";
}

export function isGrantExpired(expiresAt: Date | string | null | undefined, now = new Date()): boolean {
  if (expiresAt == null) return false;
  const t = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(t.getTime())) return false;
  return t.getTime() <= now.getTime();
}

/** True when the grant has not started yet (startsAt is in the future). */
export function isGrantScheduled(startsAt: Date | string | null | undefined, now = new Date()): boolean {
  if (startsAt == null) return false;
  const t = startsAt instanceof Date ? startsAt : new Date(startsAt);
  if (Number.isNaN(t.getTime())) return false;
  return t.getTime() > now.getTime();
}

/** Parse body expiresAt / startsAt: ISO string, or null/"" to clear. Undefined = leave unchanged. */
export function parseOptionalDate(raw: unknown, field = "date"): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new Error(`${field} must be an ISO datetime string or null`);
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) throw new Error(`${field} is not a valid datetime`);
  return d;
}

/** @deprecated Use parseOptionalDate */
export const parseExpiresAt = (raw: unknown) => parseOptionalDate(raw, "expiresAt");

export type AccessBatchSummary = {
  id: number;
  name: string | null;
  stage: string;
  linkKind: string;
  url: string;
  enabled: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  scheduled: boolean;
  userCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccessBatchDetail = AccessBatchSummary & {
  academyUserIds: string[];
};

export type StudentAccessGrant = {
  stage: AccessStage;
  linkKind: AccessLinkKind;
  url: string;
  batchId: number;
  name: string | null;
  startsAt: string | null;
  expiresAt: string | null;
};

export type AccessPreviewGrant = StudentAccessGrant & {
  enabled: boolean;
  expired: boolean;
  scheduled: boolean;
  /** Would this grant currently show to the student? */
  studentVisible: boolean;
};

export type AccessPreviewSlot = {
  stage: AccessStage;
  stageLabel: string;
  linkKind: AccessLinkKind;
  url: string;
  batchName: string | null;
  startsAt: string | null;
  expiresAt: string | null;
};

function parseIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  ];
}

function toSummary(
  b: typeof accessBatchesTable.$inferSelect,
  userCount: number,
  now = new Date(),
): AccessBatchSummary {
  const startsAt = b.startsAt ? b.startsAt.toISOString() : null;
  const expiresAt = b.expiresAt ? b.expiresAt.toISOString() : null;
  return {
    id: b.id,
    name: b.name,
    stage: b.stage,
    linkKind: b.linkKind,
    url: b.url,
    enabled: b.enabled === 1,
    startsAt,
    expiresAt,
    expired: isGrantExpired(b.expiresAt, now),
    scheduled: isGrantScheduled(b.startsAt, now),
    userCount,
    createdBy: b.createdBy,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function listAccessBatches(): Promise<AccessBatchSummary[]> {
  const now = new Date();
  const batches = await db.select().from(accessBatchesTable).orderBy(accessBatchesTable.id);
  if (batches.length === 0) return [];

  const counts = await db
    .select({
      batchId: accessBatchUsersTable.batchId,
      userCount: count(),
    })
    .from(accessBatchUsersTable)
    .groupBy(accessBatchUsersTable.batchId);

  const countMap = new Map(counts.map((c) => [c.batchId, Number(c.userCount)]));

  return batches.map((b) => toSummary(b, countMap.get(b.id) ?? 0, now));
}

export async function getAccessBatch(id: number): Promise<AccessBatchDetail | null> {
  const [batch] = await db
    .select()
    .from(accessBatchesTable)
    .where(eq(accessBatchesTable.id, id))
    .limit(1);
  if (!batch) return null;

  const users = await db
    .select({ academyUserId: accessBatchUsersTable.academyUserId })
    .from(accessBatchUsersTable)
    .where(eq(accessBatchUsersTable.batchId, id));

  return {
    ...toSummary(batch, users.length),
    academyUserIds: users.map((u) => u.academyUserId),
  };
}

export async function createAccessBatch(input: {
  name?: string | null;
  stage: AccessStage;
  linkKind: AccessLinkKind;
  url: string;
  academyUserIds: string[];
  startsAt?: Date | null;
  expiresAt?: Date | null;
  createdBy?: string | null;
}): Promise<AccessBatchDetail> {
  const ids = parseIds(input.academyUserIds);
  if (ids.length === 0) {
    throw new Error("academyUserIds must be a non-empty array");
  }
  const url = input.url.trim();
  if (!url) throw new Error("url is required");

  const now = new Date();
  const [row] = await db
    .insert(accessBatchesTable)
    .values({
      name: input.name?.trim() || null,
      stage: input.stage,
      linkKind: input.linkKind,
      url,
      enabled: 1,
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const batchId = row.id;
  const chunk = 500;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    await db.insert(accessBatchUsersTable).values(
      slice.map((academyUserId) => ({
        batchId,
        academyUserId,
        createdAt: now,
      })),
    ).onConflictDoNothing();
  }

  const detail = await getAccessBatch(batchId);
  if (!detail) throw new Error("Failed to load created batch");
  return detail;
}

export async function updateAccessBatch(
  id: number,
  input: {
    name?: string | null;
    url?: string;
    enabled?: boolean;
    startsAt?: Date | null;
    expiresAt?: Date | null;
    academyUserIds?: string[];
  },
): Promise<AccessBatchDetail | null> {
  const existing = await getAccessBatch(id);
  if (!existing) return null;

  const now = new Date();
  const patch: Partial<typeof accessBatchesTable.$inferInsert> = { updatedAt: now };
  if (input.name !== undefined) patch.name = input.name?.trim() || null;
  if (typeof input.url === "string") {
    const url = input.url.trim();
    if (!url) throw new Error("url cannot be empty");
    patch.url = url;
  }
  if (typeof input.enabled === "boolean") patch.enabled = input.enabled ? 1 : 0;
  if (input.startsAt !== undefined) patch.startsAt = input.startsAt;
  if (input.expiresAt !== undefined) patch.expiresAt = input.expiresAt;

  await db.update(accessBatchesTable).set(patch).where(eq(accessBatchesTable.id, id));

  if (Array.isArray(input.academyUserIds)) {
    const ids = parseIds(input.academyUserIds);
    await db.delete(accessBatchUsersTable).where(eq(accessBatchUsersTable.batchId, id));
    if (ids.length > 0) {
      const chunk = 500;
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk);
        await db.insert(accessBatchUsersTable).values(
          slice.map((academyUserId) => ({
            batchId: id,
            academyUserId,
            createdAt: now,
          })),
        );
      }
    }
  }

  return getAccessBatch(id);
}

export async function deleteAccessBatch(id: number): Promise<boolean> {
  const deleted = await db
    .delete(accessBatchesTable)
    .where(eq(accessBatchesTable.id, id))
    .returning({ id: accessBatchesTable.id });
  return deleted.length > 0;
}

/** Enabled + not-yet-expired + already-started grants for a single academy user (student-facing). */
export async function getStudentAccessGrants(
  academyUserId: string,
): Promise<StudentAccessGrant[]> {
  const now = new Date();
  const rows = await db
    .select({
      batchId: accessBatchesTable.id,
      name: accessBatchesTable.name,
      stage: accessBatchesTable.stage,
      linkKind: accessBatchesTable.linkKind,
      url: accessBatchesTable.url,
      enabled: accessBatchesTable.enabled,
      startsAt: accessBatchesTable.startsAt,
      expiresAt: accessBatchesTable.expiresAt,
    })
    .from(accessBatchUsersTable)
    .innerJoin(
      accessBatchesTable,
      eq(accessBatchUsersTable.batchId, accessBatchesTable.id),
    )
    .where(
      and(
        eq(accessBatchUsersTable.academyUserId, academyUserId),
        eq(accessBatchesTable.enabled, 1),
        // not yet expired
        or(isNull(accessBatchesTable.expiresAt), gt(accessBatchesTable.expiresAt, now)),
        // already started (startsAt null = immediate)
        or(isNull(accessBatchesTable.startsAt), lte(accessBatchesTable.startsAt, now)),
      ),
    );

  return rows
    .filter((r) => isAccessStage(r.stage) && isAccessLinkKind(r.linkKind))
    .map((r) => ({
      batchId: r.batchId,
      name: r.name,
      stage: r.stage as AccessStage,
      linkKind: r.linkKind as AccessLinkKind,
      url: r.url,
      startsAt: r.startsAt ? r.startsAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    }));
}

/** Admin: all grants for a UID (including disabled/expired/scheduled) + student-visible preview slots. */
export async function getAccessPreviewForUser(academyUserId: string): Promise<{
  academyUserId: string;
  grants: AccessPreviewGrant[];
  studentVisible: AccessPreviewSlot[];
}> {
  const now = new Date();
  const uid = academyUserId.trim();
  const rows = await db
    .select({
      batchId: accessBatchesTable.id,
      name: accessBatchesTable.name,
      stage: accessBatchesTable.stage,
      linkKind: accessBatchesTable.linkKind,
      url: accessBatchesTable.url,
      enabled: accessBatchesTable.enabled,
      startsAt: accessBatchesTable.startsAt,
      expiresAt: accessBatchesTable.expiresAt,
    })
    .from(accessBatchUsersTable)
    .innerJoin(
      accessBatchesTable,
      eq(accessBatchUsersTable.batchId, accessBatchesTable.id),
    )
    .where(eq(accessBatchUsersTable.academyUserId, uid));

  const grants: AccessPreviewGrant[] = rows
    .filter((r) => isAccessStage(r.stage) && isAccessLinkKind(r.linkKind))
    .map((r) => {
      const expired = isGrantExpired(r.expiresAt, now);
      const scheduled = isGrantScheduled(r.startsAt, now);
      const enabled = r.enabled === 1;
      return {
        batchId: r.batchId,
        name: r.name,
        stage: r.stage as AccessStage,
        linkKind: r.linkKind as AccessLinkKind,
        url: r.url,
        startsAt: r.startsAt ? r.startsAt.toISOString() : null,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        enabled,
        expired,
        scheduled,
        studentVisible: enabled && !expired && !scheduled,
      };
    });

  const studentVisible: AccessPreviewSlot[] = grants
    .filter((g) => g.studentVisible)
    .map((g) => ({
      stage: g.stage,
      stageLabel: L1_ACCESS_STAGE_LABELS[g.stage],
      linkKind: g.linkKind,
      url: g.url,
      batchName: g.name,
      startsAt: g.startsAt,
      expiresAt: g.expiresAt,
    }));

  return { academyUserId: uid, grants, studentVisible };
}
