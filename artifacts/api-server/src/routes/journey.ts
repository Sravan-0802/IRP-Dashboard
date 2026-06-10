import { Router } from "express";
import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const STUDENT_ID = 1;

// ── Journey state machine ──────────────────────────────────────────────────
const STANDARD_STATES = [
  "L1_PREP",
  "L1_EXAM_OPEN",
  "L1_REATTEMPT_WAITING",
  "L1_REATTEMPT_ACTIVE",
  "L1_POST_ASSESSMENT",
  "L1_POST_REATTEMPT_WAITING",
  "L1_POST_REATTEMPT_ACTIVE",
  "L2_PREP",
  "L2_EXAM_OPEN",
  "L2_REATTEMPT_WAITING",
  "L2_REATTEMPT_ACTIVE",
  "L2_POST_ASSESSMENT",
  "L2_POST_REATTEMPT_WAITING",
  "L2_POST_REATTEMPT_ACTIVE",
  "L3_PREP",
  "L3_EXAM_OPEN",
  "L3_REATTEMPT_WAITING",
  "L3_REATTEMPT_ACTIVE",
  "L3_POST_ASSESSMENT",
  "L3_POST_REATTEMPT_WAITING",
  "L3_POST_REATTEMPT_ACTIVE",
  "PLACED",
] as const;

const WILDCARD_STATES = [
  "WILDCARD_ACTIVE",
  "L3_EXAM_OPEN",
  "L3_REATTEMPT_WAITING",
  "L3_REATTEMPT_ACTIVE",
  "L3_POST_ASSESSMENT",
  "L3_POST_REATTEMPT_WAITING",
  "L3_POST_REATTEMPT_ACTIVE",
  "PLACED",
] as const;

const ALL_STATES = new Set<string>([...STANDARD_STATES, ...WILDCARD_STATES]);

async function ensureStudent() {
  const [existing] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, STUDENT_ID))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(studentsTable)
    .values({
      id: STUDENT_ID,
      name: "Student",
      yog: 2028,
      email: "student-1@academy.local",
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [row] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, STUDENT_ID))
    .limit(1);
  return row;
}

// ── L1-only gate (temporary) ────────────────────────────────────────────────
// Only Level 1 is live right now. Any stored state above L1 (or a Wildcard /
// PLACED state) is clamped down to its Level 1 equivalent on read, so students
// always see the L1 journey regardless of stale data. Remove this clamp once
// L2/L3 progression goes live.
function clampToL1(state: string): string {
  if (state.startsWith("L1_")) return state;
  if (state.startsWith("L2_") || state.startsWith("L3_")) {
    return "L1_" + state.slice(3);
  }
  // WILDCARD_ACTIVE, PLACED, or anything unrecognized.
  return "L1_PREP";
}

function serialize(s: typeof studentsTable.$inferSelect) {
  return {
    journeyState: clampToL1(s.journeyState),
    isWildcard: false,
    hasCompletedOnboarding: s.hasCompletedOnboarding === 1,
    hasAttemptedL1: s.hasAttemptedL1 === 1,
    l3ExamStarted: s.l3ExamStarted === 1,
    reattemptDate: s.reattemptDate,
    projectSubmitted: s.projectSubmitted === 1,
    projectDueDate: s.projectDueDate,
  };
}

router.get("/student/journey", async (req, res) => {
  try {
    const student = await ensureStudent();
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    res.json(serialize(student));
  } catch (err) {
    req.log.error({ err }, "Failed to get journey");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Onboarding path selection (first login only).
router.post("/student/journey/onboard", async (req, res) => {
  try {
    const path = String(req.body?.path ?? "");
    if (path !== "standard" && path !== "wildcard") {
      res.status(400).json({ error: "path must be 'standard' or 'wildcard'" });
      return;
    }
    await ensureStudent();
    const [updated] = await db
      .update(studentsTable)
      .set({
        hasCompletedOnboarding: 1,
        isWildcard: path === "wildcard" ? 1 : 0,
        journeyState: path === "wildcard" ? "WILDCARD_ACTIVE" : "L1_PREP",
      })
      .where(eq(studentsTable.id, STUDENT_ID))
      .returning();
    res.json(serialize(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to complete onboarding");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Bidirectional path switching (post-onboarding).
router.post("/student/journey/switch", async (req, res) => {
  try {
    const to = String(req.body?.to ?? "");
    if (to !== "standard" && to !== "wildcard") {
      res.status(400).json({ error: "to must be 'standard' or 'wildcard'" });
      return;
    }
    const student = await ensureStudent();
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    if (to === "wildcard") {
      // Block if the student has already begun the standard assessment.
      if (student.hasAttemptedL1 === 1 || student.journeyState !== "L1_PREP") {
        res.status(409).json({
          error:
            "You've already begun the standard path assessment. Switching to Wildcard is no longer available.",
        });
        return;
      }
      const [updated] = await db
        .update(studentsTable)
        .set({ isWildcard: 1, journeyState: "WILDCARD_ACTIVE" })
        .where(eq(studentsTable.id, STUDENT_ID))
        .returning();
      res.json(serialize(updated));
      return;
    }

    // to === "standard"
    if (student.l3ExamStarted === 1) {
      res.status(409).json({
        error: "This cannot be undone once your L3 exam has started.",
      });
      return;
    }
    const [updated] = await db
      .update(studentsTable)
      .set({ isWildcard: 0, journeyState: "L1_PREP" })
      .where(eq(studentsTable.id, STUDENT_ID))
      .returning();
    res.json(serialize(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to switch path");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin / preview: set an arbitrary valid journey state (and related flags).
router.post("/student/journey/state", async (req, res) => {
  try {
    const state = String(req.body?.state ?? "");
    if (!ALL_STATES.has(state)) {
      res.status(400).json({ error: "Invalid journey_state" });
      return;
    }
    await ensureStudent();
    const patch: Partial<typeof studentsTable.$inferInsert> = {
      journeyState: state,
    };
    if (typeof req.body?.reattemptDate === "string") patch.reattemptDate = req.body.reattemptDate;
    if (typeof req.body?.projectDueDate === "string") patch.projectDueDate = req.body.projectDueDate;
    if (typeof req.body?.projectSubmitted === "boolean")
      patch.projectSubmitted = req.body.projectSubmitted ? 1 : 0;
    if (state.startsWith("L1_") && state !== "L1_PREP") patch.hasAttemptedL1 = 1;
    if (state === "L3_EXAM_OPEN" || state.startsWith("L3_REATTEMPT") || state.startsWith("L3_POST"))
      patch.l3ExamStarted = 1;

    const [updated] = await db
      .update(studentsTable)
      .set(patch)
      .where(eq(studentsTable.id, STUDENT_ID))
      .returning();
    res.json(serialize(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to set journey state");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
