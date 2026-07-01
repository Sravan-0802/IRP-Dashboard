import { Router } from "express";
import {
  db,
  studentsTable,
  academyUserBasicDetailsTable,
  academyUserAssessmentDetailsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
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

export default router;
