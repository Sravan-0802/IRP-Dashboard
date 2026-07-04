import { Router } from "express";
import {
  db,
  studentsTable,
  academyUserBasicDetailsTable,
  academyUserAssessmentDetailsTable,
  l1CycleRegistrationsTable,
  l1ExamAccessTable,
} from "@workspace/db";
import { inArray, eq, and, sql } from "drizzle-orm";
import { checkApiKey } from "../lib/apiKey";
import { emailForUser } from "../lib/student";

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

export default router;
