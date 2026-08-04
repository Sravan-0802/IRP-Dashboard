import { and, count, eq, gt, isNull, lte, or } from "drizzle-orm";
import {
  db,
  registrationBatchesTable,
  registrationBatchUsersTable,
  l1CycleRegistrationsTable,
  academyUserBasicDetailsTable,
} from "@workspace/db";
import { parseOptionalDate, isGrantScheduled, isGrantExpired } from "./accessBatches";

export type RegistrationBatchSummary = {
  id: number;
  name: string | null;
  assessmentLabel: string;
  assessmentDate: string;
  slotId: string | null;
  slotLabel: string | null;
  enabled: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  scheduled: boolean;
  userCount: number;
  responseCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RegistrationBatchDetail = RegistrationBatchSummary & {
  academyUserIds: string[];
};

export type ActiveRegistrationBatch = {
  id: number;
  name: string | null;
  assessmentLabel: string;
  assessmentDate: string;
  slotId: string | null;
  slotLabel: string | null;
  startsAt: string | null;
  expiresAt: string | null;
};

export type BatchRegistrationResponse = {
  id: number;
  academyUserId: string;
  userName: string | null;
  batchId: number;
  batchName: string | null;
  assessmentLabel: string;
  cycle: number;
  availability: string;
  slotId: string | null;
  slotLabel: string | null;
  understandsGc: boolean | null;
  willAttend: boolean | null;
  unavailabilityReason: string | null;
  notifyNextCycle: boolean | null;
  submittedAt: string;
};

function toSummary(
  b: typeof registrationBatchesTable.$inferSelect,
  userCount: number,
  responseCount: number,
  now = new Date(),
): RegistrationBatchSummary {
  return {
    id: b.id,
    name: b.name,
    assessmentLabel: b.assessmentLabel,
    assessmentDate: b.assessmentDate,
    slotId: b.slotId,
    slotLabel: b.slotLabel,
    enabled: b.enabled === 1,
    startsAt: b.startsAt ? b.startsAt.toISOString() : null,
    expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
    expired: isGrantExpired(b.expiresAt, now),
    scheduled: isGrantScheduled(b.startsAt, now),
    userCount,
    responseCount,
    createdBy: b.createdBy,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function listRegistrationBatches(): Promise<RegistrationBatchSummary[]> {
  const now = new Date();
  const batches = await db
    .select()
    .from(registrationBatchesTable)
    .orderBy(registrationBatchesTable.id);
  if (batches.length === 0) return [];

  const [userCounts, responseCounts] = await Promise.all([
    db
      .select({ batchId: registrationBatchUsersTable.batchId, cnt: count() })
      .from(registrationBatchUsersTable)
      .groupBy(registrationBatchUsersTable.batchId),
    db
      .select({ batchId: l1CycleRegistrationsTable.batchId, cnt: count() })
      .from(l1CycleRegistrationsTable)
      .groupBy(l1CycleRegistrationsTable.batchId),
  ]);

  const userMap = new Map(userCounts.map((r) => [r.batchId, Number(r.cnt)]));
  const responseMap = new Map(
    responseCounts
      .filter((r) => r.batchId !== null)
      .map((r) => [r.batchId!, Number(r.cnt)]),
  );

  return batches.map((b) =>
    toSummary(b, userMap.get(b.id) ?? 0, responseMap.get(b.id) ?? 0, now),
  );
}

export async function getRegistrationBatch(id: number): Promise<RegistrationBatchDetail | null> {
  const [batch] = await db
    .select()
    .from(registrationBatchesTable)
    .where(eq(registrationBatchesTable.id, id))
    .limit(1);
  if (!batch) return null;

  const [users, responses] = await Promise.all([
    db
      .select({ academyUserId: registrationBatchUsersTable.academyUserId })
      .from(registrationBatchUsersTable)
      .where(eq(registrationBatchUsersTable.batchId, id)),
    db
      .select({ cnt: count() })
      .from(l1CycleRegistrationsTable)
      .where(eq(l1CycleRegistrationsTable.batchId, id)),
  ]);

  return {
    ...toSummary(batch, users.length, Number(responses[0]?.cnt ?? 0)),
    academyUserIds: users.map((u) => u.academyUserId),
  };
}

function parseIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))];
}

export async function createRegistrationBatch(input: {
  name?: string | null;
  assessmentLabel: string;
  assessmentDate: string;
  slotId?: string | null;
  slotLabel?: string | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  academyUserIds: string[];
  createdBy?: string | null;
}): Promise<RegistrationBatchDetail> {
  const ids = parseIds(input.academyUserIds);
  if (ids.length === 0) throw new Error("academyUserIds must be a non-empty array");
  const assessmentLabel = input.assessmentLabel.trim();
  if (!assessmentLabel) throw new Error("assessmentLabel is required");
  const assessmentDate = input.assessmentDate.trim();
  if (!assessmentDate) throw new Error("assessmentDate is required");

  const now = new Date();
  const [row] = await db
    .insert(registrationBatchesTable)
    .values({
      name: input.name?.trim() || null,
      assessmentLabel,
      assessmentDate,
      slotId: input.slotId?.trim() || null,
      slotLabel: input.slotLabel?.trim() || null,
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
    await db
      .insert(registrationBatchUsersTable)
      .values(ids.slice(i, i + chunk).map((academyUserId) => ({ batchId, academyUserId, createdAt: now })))
      .onConflictDoNothing();
  }

  const detail = await getRegistrationBatch(batchId);
  if (!detail) throw new Error("Failed to load created batch");
  return detail;
}

export async function updateRegistrationBatch(
  id: number,
  input: {
    name?: string | null;
    assessmentLabel?: string;
    assessmentDate?: string;
    slotId?: string | null;
    slotLabel?: string | null;
    enabled?: boolean;
    startsAt?: Date | null;
    expiresAt?: Date | null;
    academyUserIds?: string[];
  },
): Promise<RegistrationBatchDetail | null> {
  const existing = await getRegistrationBatch(id);
  if (!existing) return null;

  const now = new Date();
  const patch: Partial<typeof registrationBatchesTable.$inferInsert> = { updatedAt: now };
  if (input.name !== undefined) patch.name = input.name?.trim() || null;
  if (typeof input.assessmentLabel === "string") {
    const v = input.assessmentLabel.trim();
    if (!v) throw new Error("assessmentLabel cannot be empty");
    patch.assessmentLabel = v;
  }
  if (typeof input.assessmentDate === "string") {
    const v = input.assessmentDate.trim();
    if (!v) throw new Error("assessmentDate cannot be empty");
    patch.assessmentDate = v;
  }
  if (input.slotId !== undefined) patch.slotId = input.slotId?.trim() || null;
  if (input.slotLabel !== undefined) patch.slotLabel = input.slotLabel?.trim() || null;
  if (typeof input.enabled === "boolean") patch.enabled = input.enabled ? 1 : 0;
  if (input.startsAt !== undefined) patch.startsAt = input.startsAt;
  if (input.expiresAt !== undefined) patch.expiresAt = input.expiresAt;

  await db.update(registrationBatchesTable).set(patch).where(eq(registrationBatchesTable.id, id));

  if (Array.isArray(input.academyUserIds)) {
    const ids = parseIds(input.academyUserIds);
    await db.delete(registrationBatchUsersTable).where(eq(registrationBatchUsersTable.batchId, id));
    if (ids.length > 0) {
      const chunk = 500;
      for (let i = 0; i < ids.length; i += chunk) {
        await db.insert(registrationBatchUsersTable).values(
          ids.slice(i, i + chunk).map((academyUserId) => ({ batchId: id, academyUserId, createdAt: now })),
        );
      }
    }
  }

  return getRegistrationBatch(id);
}

export async function deleteRegistrationBatch(id: number): Promise<boolean> {
  const deleted = await db
    .delete(registrationBatchesTable)
    .where(eq(registrationBatchesTable.id, id))
    .returning({ id: registrationBatchesTable.id });
  return deleted.length > 0;
}

/** Returns the first active registration batch for a student, or null if none. */
export async function getActiveRegistrationBatchForStudent(academyUserId: string): Promise<{
  batch: ActiveRegistrationBatch;
  hasResponded: boolean;
} | null> {
  const now = new Date();
  const rows = await db
    .select({
      id: registrationBatchesTable.id,
      name: registrationBatchesTable.name,
      assessmentLabel: registrationBatchesTable.assessmentLabel,
      assessmentDate: registrationBatchesTable.assessmentDate,
      slotId: registrationBatchesTable.slotId,
      slotLabel: registrationBatchesTable.slotLabel,
      startsAt: registrationBatchesTable.startsAt,
      expiresAt: registrationBatchesTable.expiresAt,
    })
    .from(registrationBatchUsersTable)
    .innerJoin(registrationBatchesTable, eq(registrationBatchUsersTable.batchId, registrationBatchesTable.id))
    .where(
      and(
        eq(registrationBatchUsersTable.academyUserId, academyUserId),
        eq(registrationBatchesTable.enabled, 1),
        or(isNull(registrationBatchesTable.startsAt), lte(registrationBatchesTable.startsAt, now)),
        or(isNull(registrationBatchesTable.expiresAt), gt(registrationBatchesTable.expiresAt, now)),
      ),
    )
    .limit(5);

  if (rows.length === 0) return null;

  // Check which batches the student has already responded to
  const batchIds = rows.map((r) => r.id);
  const responded = await db
    .select({ batchId: l1CycleRegistrationsTable.batchId })
    .from(l1CycleRegistrationsTable)
    .where(
      and(
        eq(l1CycleRegistrationsTable.academyUserId, academyUserId),
        // Filter to batchIds we found — use inArray-style OR
      ),
    );

  // Simple: just check for any of our batch IDs
  const respondedIds = new Set(
    responded
      .map((r) => r.batchId)
      .filter((id): id is number => id !== null && batchIds.includes(id)),
  );

  // Return the first active batch (prefer unresponded, then responded)
  const unresponded = rows.filter((r) => !respondedIds.has(r.id));
  const target = unresponded[0] ?? rows[0];
  const hasResponded = respondedIds.has(target.id);

  return {
    batch: {
      id: target.id,
      name: target.name,
      assessmentLabel: target.assessmentLabel,
      assessmentDate: target.assessmentDate,
      slotId: target.slotId,
      slotLabel: target.slotLabel,
      startsAt: target.startsAt ? target.startsAt.toISOString() : null,
      expiresAt: target.expiresAt ? target.expiresAt.toISOString() : null,
    },
    hasResponded,
  };
}

/** Admin: all responses for a registration batch with student names. */
export async function getRegistrationBatchResponses(batchId: number): Promise<BatchRegistrationResponse[]> {
  const rows = await db
    .select({
      id: l1CycleRegistrationsTable.id,
      academyUserId: l1CycleRegistrationsTable.academyUserId,
      userName: l1CycleRegistrationsTable.userName,
      batchId: l1CycleRegistrationsTable.batchId,
      cycle: l1CycleRegistrationsTable.cycle,
      availability: l1CycleRegistrationsTable.availability,
      slotId: l1CycleRegistrationsTable.slotId,
      slotLabel: l1CycleRegistrationsTable.slotLabel,
      understandsGc: l1CycleRegistrationsTable.understandsGc,
      willAttend: l1CycleRegistrationsTable.willAttend,
      unavailabilityReason: l1CycleRegistrationsTable.unavailabilityReason,
      notifyNextCycle: l1CycleRegistrationsTable.notifyNextCycle,
      submittedAt: l1CycleRegistrationsTable.submittedAt,
      batchName: registrationBatchesTable.name,
      assessmentLabel: registrationBatchesTable.assessmentLabel,
    })
    .from(l1CycleRegistrationsTable)
    .innerJoin(registrationBatchesTable, eq(l1CycleRegistrationsTable.batchId, registrationBatchesTable.id))
    .where(eq(l1CycleRegistrationsTable.batchId, batchId))
    .orderBy(l1CycleRegistrationsTable.submittedAt);

  return rows.map((r) => ({
    id: r.id,
    academyUserId: r.academyUserId,
    userName: r.userName,
    batchId: r.batchId!,
    batchName: r.batchName,
    assessmentLabel: r.assessmentLabel,
    cycle: r.cycle,
    availability: r.availability,
    slotId: r.slotId,
    slotLabel: r.slotLabel,
    understandsGc: r.understandsGc === 1 ? true : r.understandsGc === 0 ? false : null,
    willAttend: r.willAttend === 1 ? true : r.willAttend === 0 ? false : null,
    unavailabilityReason: r.unavailabilityReason,
    notifyNextCycle: r.notifyNextCycle === 1 ? true : r.notifyNextCycle === 0 ? false : null,
    submittedAt: r.submittedAt.toISOString(),
  }));
}

/** Admin: all responses across ALL registration batches. */
export async function getAllRegistrationBatchResponses(): Promise<BatchRegistrationResponse[]> {
  const rows = await db
    .select({
      id: l1CycleRegistrationsTable.id,
      academyUserId: l1CycleRegistrationsTable.academyUserId,
      userName: l1CycleRegistrationsTable.userName,
      batchId: l1CycleRegistrationsTable.batchId,
      cycle: l1CycleRegistrationsTable.cycle,
      availability: l1CycleRegistrationsTable.availability,
      slotId: l1CycleRegistrationsTable.slotId,
      slotLabel: l1CycleRegistrationsTable.slotLabel,
      understandsGc: l1CycleRegistrationsTable.understandsGc,
      willAttend: l1CycleRegistrationsTable.willAttend,
      unavailabilityReason: l1CycleRegistrationsTable.unavailabilityReason,
      notifyNextCycle: l1CycleRegistrationsTable.notifyNextCycle,
      submittedAt: l1CycleRegistrationsTable.submittedAt,
      batchName: registrationBatchesTable.name,
      assessmentLabel: registrationBatchesTable.assessmentLabel,
    })
    .from(l1CycleRegistrationsTable)
    .innerJoin(registrationBatchesTable, eq(l1CycleRegistrationsTable.batchId, registrationBatchesTable.id))
    .orderBy(l1CycleRegistrationsTable.batchId, l1CycleRegistrationsTable.submittedAt);

  return rows.map((r) => ({
    id: r.id,
    academyUserId: r.academyUserId,
    userName: r.userName,
    batchId: r.batchId!,
    batchName: r.batchName,
    assessmentLabel: r.assessmentLabel,
    cycle: r.cycle,
    availability: r.availability,
    slotId: r.slotId,
    slotLabel: r.slotLabel,
    understandsGc: r.understandsGc === 1 ? true : r.understandsGc === 0 ? false : null,
    willAttend: r.willAttend === 1 ? true : r.willAttend === 0 ? false : null,
    unavailabilityReason: r.unavailabilityReason,
    notifyNextCycle: r.notifyNextCycle === 1 ? true : r.notifyNextCycle === 0 ? false : null,
    submittedAt: r.submittedAt.toISOString(),
  }));
}
