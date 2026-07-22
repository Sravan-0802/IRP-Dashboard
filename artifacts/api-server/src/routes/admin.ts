import { Router } from "express";
import {
  db,
  studentsTable,
  academyUserBasicDetailsTable,
  academyUserAssessmentDetailsTable,
  l1CycleRegistrationsTable,
  l1ExamAccessTable,
  unpaidUsersTable,
  blockedUsersTable,
} from "@workspace/db";
import { inArray, eq, and, sql } from "drizzle-orm";
import { checkApiKey } from "../lib/apiKey";
import { emailForUser } from "../lib/student";
import {
  getVisibilitySettings,
  parseAdminSettingsBody,
  toResponse,
  updateVisibilitySettings,
} from "../lib/visibilitySettings";

const router = Router();

// POST /api/admin/students/fe-project-done — mark a batch of academy users as
// having cleared L1 and completed their FE Project (admin API key required).
// Body: { academyUserIds: string[] }
router.post("/admin/students/fe-project-done", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = req.body?.academyUserIds;
    const academyUserIds = Array.isArray(raw)
      ? [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))]
      : [];
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    // Only act on enrolled users (those present in the synced assessment data).
    const enrolledRows = await db
      .select({ userId: academyUserAssessmentDetailsTable.userId })
      .from(academyUserAssessmentDetailsTable)
      .where(inArray(academyUserAssessmentDetailsTable.userId, academyUserIds));
    const enrolled = new Set(enrolledRows.map((r) => r.userId));
    const skipped = academyUserIds.filter((id) => !enrolled.has(id));
    const targets = academyUserIds.filter((id) => enrolled.has(id));

    // Resolve names for any rows we may need to create.
    const basicRows = targets.length
      ? await db
          .select({
            userId: academyUserBasicDetailsTable.userId,
            userName: academyUserBasicDetailsTable.userName,
          })
          .from(academyUserBasicDetailsTable)
          .where(inArray(academyUserBasicDetailsTable.userId, targets))
      : [];
    const nameMap = new Map(basicRows.map((r) => [r.userId, r.userName]));

    const updated: string[] = [];
    for (const userId of targets) {
      await db
        .insert(studentsTable)
        .values({
          name: nameMap.get(userId) ?? "Student",
          yog: 2028,
          email: emailForUser(userId),
          journeyState: "L1_POST_ASSESSMENT",
          projectSubmitted: 1,
          hasAttemptedL1: 1,
          hasCompletedOnboarding: 1,
        })
        .onConflictDoUpdate({
          target: studentsTable.email,
          set: {
            journeyState: "L1_POST_ASSESSMENT",
            projectSubmitted: 1,
            hasAttemptedL1: 1,
            hasCompletedOnboarding: 1,
          },
        });
      updated.push(userId);
    }

    res.json({
      requested: academyUserIds.length,
      updated: updated.length,
      updatedIds: updated,
      skipped,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to mark FE project done");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/students/ai-mock-cleared — mark a batch of academy users as
// having cleared the AI Mock Interview (admin API key required).
// Body: { academyUserIds: string[] }
router.post("/admin/students/ai-mock-cleared", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = req.body?.academyUserIds;
    const academyUserIds = Array.isArray(raw)
      ? [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))]
      : [];
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    const enrolledRows = await db
      .select({ userId: academyUserAssessmentDetailsTable.userId })
      .from(academyUserAssessmentDetailsTable)
      .where(inArray(academyUserAssessmentDetailsTable.userId, academyUserIds));
    const enrolled = new Set(enrolledRows.map((r) => r.userId));
    const skipped = academyUserIds.filter((id) => !enrolled.has(id));
    const targets = academyUserIds.filter((id) => enrolled.has(id));

    const basicRows = targets.length
      ? await db
          .select({
            userId: academyUserBasicDetailsTable.userId,
            userName: academyUserBasicDetailsTable.userName,
          })
          .from(academyUserBasicDetailsTable)
          .where(inArray(academyUserBasicDetailsTable.userId, targets))
      : [];
    const nameMap = new Map(basicRows.map((r) => [r.userId, r.userName]));

    const updated: string[] = [];
    for (const userId of targets) {
      await db
        .insert(studentsTable)
        .values({
          name: nameMap.get(userId) ?? "Student",
          yog: 2028,
          email: emailForUser(userId),
          journeyState: "L1_HUMAN_INTERVIEW",
          projectSubmitted: 1,
          hasAttemptedL1: 1,
          hasCompletedOnboarding: 1,
        })
        .onConflictDoUpdate({
          target: studentsTable.email,
          set: {
            journeyState: "L1_HUMAN_INTERVIEW",
            projectSubmitted: 1,
            hasAttemptedL1: 1,
            hasCompletedOnboarding: 1,
          },
        });
      updated.push(userId);
    }

    res.json({
      requested: academyUserIds.length,
      updated: updated.length,
      updatedIds: updated,
      skipped,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to mark AI mock cleared");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/students/reset-l1-registration — delete a student's L1 cycle
// registration so they can re-register with a different slot (admin key required).
// Body: { academyUserId: string, cycle?: number }
router.post("/admin/students/reset-l1-registration", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const academyUserId = String(req.body?.academyUserId ?? "").trim();
    if (!academyUserId) {
      res.status(400).json({ error: "academyUserId is required" });
      return;
    }
    const cycle = Number(req.body?.cycle ?? 2);
    const deleted = await db
      .delete(l1CycleRegistrationsTable)
      .where(
        and(
          eq(l1CycleRegistrationsTable.academyUserId, academyUserId),
          eq(l1CycleRegistrationsTable.cycle, cycle),
        ),
      )
      .returning({ id: l1CycleRegistrationsTable.id });
    res.json({ reset: deleted.length > 0, deletedRows: deleted.length, academyUserId, cycle });
  } catch (err) {
    req.log.error({ err }, "Failed to reset L1 registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/l1-exam-access/import — bulk upsert the authoritative
// exam-platform slot mapping (admin API key required). This is the source of
// truth for which slot's MAIN assessment link each student sees.
// Body: { cycle?: number, entries: { academyUserId: string, slotId: "slot-1" | "slot-2" }[] }
router.post("/admin/l1-exam-access/import", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cycle = Number(req.body?.cycle ?? 2);
    if (!Number.isInteger(cycle) || cycle <= 0) {
      res.status(400).json({ error: "cycle must be a positive integer" });
      return;
    }

    const rawEntries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const ALLOWED_SLOTS = new Set(["slot-1", "slot-2"]);
    const seen = new Set<string>();
    const values: { academyUserId: string; cycle: number; slotId: string }[] = [];
    const invalid: unknown[] = [];

    for (const entry of rawEntries) {
      const academyUserId =
        entry && typeof entry === "object" && typeof entry.academyUserId === "string"
          ? entry.academyUserId.trim()
          : "";
      const slotId =
        entry && typeof entry === "object" && typeof entry.slotId === "string"
          ? entry.slotId.trim()
          : "";
      if (!academyUserId || !ALLOWED_SLOTS.has(slotId) || seen.has(academyUserId)) {
        if (!academyUserId || !ALLOWED_SLOTS.has(slotId)) invalid.push(entry);
        continue;
      }
      seen.add(academyUserId);
      values.push({ academyUserId, cycle, slotId });
    }

    if (values.length === 0) {
      res.status(400).json({ error: "entries must contain at least one valid { academyUserId, slotId }", invalid: invalid.length });
      return;
    }

    const now = new Date();
    let upserted = 0;
    // Chunk to keep parameter counts well under Postgres limits.
    const CHUNK = 500;
    for (let i = 0; i < values.length; i += CHUNK) {
      const chunk = values.slice(i, i + CHUNK).map((v) => ({ ...v, createdAt: now, updatedAt: now }));
      const rows = await db
        .insert(l1ExamAccessTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: [l1ExamAccessTable.academyUserId, l1ExamAccessTable.cycle],
          set: { slotId: sql`excluded.slot_id`, updatedAt: now },
        })
        .returning({ id: l1ExamAccessTable.id });
      upserted += rows.length;
    }

    res.json({ requested: rawEntries.length, upserted, invalid: invalid.length });
  } catch (err) {
    req.log.error({ err }, "Failed to import L1 exam access");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/unpaid-users/import — set the list of unpaid users who are
// gated behind the "complete your payment" prompt (admin API key required).
// Body: { academyUserIds: string[], replace?: boolean }
// When replace=true the existing list is cleared first, so the payload becomes
// the authoritative set of unpaid users.
router.post("/admin/unpaid-users/import", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = req.body?.academyUserIds;
    const academyUserIds = Array.isArray(raw)
      ? [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))]
      : [];
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    const replace = req.body?.replace === true;
    const now = new Date();

    // Run clear + insert in a single transaction so a mid-import failure can
    // never leave the payment gate in a partial state.
    let inserted = 0;
    const CHUNK = 500;
    await db.transaction(async (tx) => {
      if (replace) {
        await tx.delete(unpaidUsersTable);
      }
      for (let i = 0; i < academyUserIds.length; i += CHUNK) {
        const chunk = academyUserIds
          .slice(i, i + CHUNK)
          .map((academyUserId) => ({ academyUserId, createdAt: now }));
        const rows = await tx
          .insert(unpaidUsersTable)
          .values(chunk)
          .onConflictDoNothing({ target: unpaidUsersTable.academyUserId })
          .returning({ academyUserId: unpaidUsersTable.academyUserId });
        inserted += rows.length;
      }
    });

    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(unpaidUsersTable);

    res.json({ requested: academyUserIds.length, inserted, total: count });
  } catch (err) {
    req.log.error({ err }, "Failed to import unpaid users");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/blocked-users/import — fully deny access to a set of
// academy users (admin API key required). Once blocked, resolveAcademyUserId
// returns null for that user on every route — including a valid SSO token —
// so they are treated as fully logged out with no data ever returned.
// Body: { academyUserIds: string[], reason?: string }
router.post("/admin/blocked-users/import", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = req.body?.academyUserIds;
    const academyUserIds = Array.isArray(raw)
      ? [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))]
      : [];
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() || null : null;
    const now = new Date();

    let upserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < academyUserIds.length; i += CHUNK) {
      const chunk = academyUserIds
        .slice(i, i + CHUNK)
        .map((academyUserId) => ({ academyUserId, reason, createdAt: now }));
      const rows = await db
        .insert(blockedUsersTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: blockedUsersTable.academyUserId,
          set: { reason },
        })
        .returning({ academyUserId: blockedUsersTable.academyUserId });
      upserted += rows.length;
    }

    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blockedUsersTable);

    res.json({ requested: academyUserIds.length, upserted, total: count });
  } catch (err) {
    req.log.error({ err }, "Failed to import blocked users");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/blocked-users/:academyUserId — restore access for a
// previously blocked user (admin API key required).
router.delete("/admin/blocked-users/:academyUserId", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const academyUserId = req.params.academyUserId?.trim();
    if (!academyUserId) {
      res.status(400).json({ error: "academyUserId is required" });
      return;
    }

    const rows = await db
      .delete(blockedUsersTable)
      .where(eq(blockedUsersTable.academyUserId, academyUserId))
      .returning({ academyUserId: blockedUsersTable.academyUserId });

    res.json({ removed: rows.length > 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to remove blocked user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/dashboard-access/import — grant dashboard access to a batch
// of academy users who have no assessment data yet (admin API key required).
// Inserts a minimal row into academy_user_basic_details and a placeholder row
// into academy_user_assessment_details so userHasAssessmentData() returns true.
// Body: { academyUserIds: string[] }
router.post("/admin/dashboard-access/import", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = Array.isArray(req.body?.academyUserIds) ? req.body.academyUserIds : [];
    const ids: string[] = [];
    for (const entry of raw) {
      if (typeof entry === "string" && entry.trim()) ids.push(entry.trim());
    }

    if (ids.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array of strings" });
      return;
    }

    const now = new Date();
    const CHUNK = 500;
    let upsertedBasic = 0;
    let upsertedAssessment = 0;

    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);

      // Upsert basic details (name stays null — will be filled on first BQ sync)
      const basicRows = await db
        .insert(academyUserBasicDetailsTable)
        .values(chunk.map((userId) => ({ userId, syncedAt: now })))
        .onConflictDoNothing({ target: academyUserBasicDetailsTable.userId })
        .returning({ userId: academyUserBasicDetailsTable.userId });
      upsertedBasic += basicRows.length;

      // Upsert a placeholder assessment row so userHasAssessmentData() passes
      const assessmentRows = await db
        .insert(academyUserAssessmentDetailsTable)
        .values(chunk.map((userId) => ({
          userId,
          organisationAssessmentId: "l1-july12-2026-access",
          syncedAt: now,
        })))
        .onConflictDoNothing()
        .returning({ id: academyUserAssessmentDetailsTable.id });
      upsertedAssessment += assessmentRows.length;
    }

    res.json({ requested: ids.length, upsertedBasic, upsertedAssessment });
  } catch (err) {
    req.log.error({ err }, "Failed to import dashboard access");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/visibility-settings — read student result visibility toggles
router.get("/admin/visibility-settings", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { map, updatedAt, syncByTable, countsByKey } = await getVisibilitySettings({
      includeCounts: true,
    });
    res.json(toResponse(map, updatedAt, syncByTable, countsByKey));
  } catch (err) {
    req.log.error({ err }, "Failed to get visibility settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/visibility-settings — upsert toggles (admin API key required)
// Body: { settings: { onlineL1Results?: boolean, feProjectResults?: boolean, ... } }
//    or { settings: { online_l1_results?: boolean, ... } }
router.put("/admin/visibility-settings", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const partial = parseAdminSettingsBody(req.body);
    if (!partial) {
      res.status(400).json({
        error:
          "Provide settings with at least one boolean: onlineL1Results, feProjectResults, aiMockResults, courseProgress",
      });
      return;
    }
    const { map, updatedAt, syncByTable, countsByKey } = await updateVisibilitySettings(partial);
    res.json(toResponse(map, updatedAt, syncByTable, countsByKey));
  } catch (err) {
    req.log.error({ err }, "Failed to update visibility settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
