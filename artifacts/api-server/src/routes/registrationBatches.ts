import { Router } from "express";
import { checkApiKey } from "../lib/apiKey";
import { parseOptionalDate } from "../lib/accessBatches";
import {
  createRegistrationBatch,
  deleteRegistrationBatch,
  getAllRegistrationBatchResponses,
  getRegistrationBatch,
  getRegistrationBatchResponses,
  listRegistrationBatches,
  updateRegistrationBatch,
} from "../lib/registrationBatches";

const router = Router();

function parseUserIds(body: unknown): string[] {
  const raw = (body as { academyUserIds?: unknown })?.academyUserIds;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))];
}

// GET /api/admin/registration-batches
router.get("/admin/registration-batches", async (req, res) => {
  try {
    if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
    const batches = await listRegistrationBatches();
    res.json({ batches });
  } catch (err) {
    req.log.error({ err }, "Failed to list registration batches");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/registration-batches/responses — all responses across all batches
router.get("/admin/registration-batches/responses", async (req, res) => {
  try {
    if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
    const responses = await getAllRegistrationBatchResponses();
    res.json({ responses });
  } catch (err) {
    req.log.error({ err }, "Failed to get all registration batch responses");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/registration-batches/:id
router.get("/admin/registration-batches/:id", async (req, res) => {
  try {
    if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
    const batch = await getRegistrationBatch(id);
    if (!batch) { res.status(404).json({ error: "Batch not found" }); return; }
    res.json({ batch });
  } catch (err) {
    req.log.error({ err }, "Failed to get registration batch");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/registration-batches/:id/responses
router.get("/admin/registration-batches/:id/responses", async (req, res) => {
  try {
    if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
    const responses = await getRegistrationBatchResponses(id);
    res.json({ responses });
  } catch (err) {
    req.log.error({ err }, "Failed to get batch responses");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/registration-batches
router.post("/admin/registration-batches", async (req, res) => {
  try {
    if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

    const assessmentLabel = typeof req.body?.assessmentLabel === "string" ? req.body.assessmentLabel.trim() : "";
    const assessmentDate = typeof req.body?.assessmentDate === "string" ? req.body.assessmentDate.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : null;
    const slotId = typeof req.body?.slotId === "string" ? req.body.slotId.trim() : null;
    const slotLabel = typeof req.body?.slotLabel === "string" ? req.body.slotLabel.trim() : null;
    const academyUserIds = parseUserIds(req.body);

    if (!assessmentLabel) { res.status(400).json({ error: "assessmentLabel is required" }); return; }
    if (!assessmentDate) { res.status(400).json({ error: "assessmentDate is required" }); return; }
    if (academyUserIds.length === 0) { res.status(400).json({ error: "academyUserIds must be non-empty" }); return; }

    let startsAt: Date | null = null;
    let expiresAt: Date | null = null;
    try {
      const s = parseOptionalDate("startsAt" in (req.body ?? {}) ? req.body.startsAt : null, "startsAt");
      startsAt = s === undefined ? null : s;
      const e = parseOptionalDate("expiresAt" in (req.body ?? {}) ? req.body.expiresAt : null, "expiresAt");
      expiresAt = e === undefined ? null : e;
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Invalid date" });
      return;
    }

    const batch = await createRegistrationBatch({
      name, assessmentLabel, assessmentDate, slotId, slotLabel,
      startsAt, expiresAt, academyUserIds, createdBy: "api_key",
    });
    res.status(201).json({ batch });
  } catch (err) {
    req.log.error({ err }, "Failed to create registration batch");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// PATCH /api/admin/registration-batches/:id
router.patch("/admin/registration-batches/:id", async (req, res) => {
  try {
    if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }

    const patch: Parameters<typeof updateRegistrationBatch>[1] = {};
    if ("name" in (req.body ?? {})) patch.name = typeof req.body.name === "string" ? req.body.name.trim() : null;
    if (typeof req.body?.assessmentLabel === "string") patch.assessmentLabel = req.body.assessmentLabel;
    if (typeof req.body?.assessmentDate === "string") patch.assessmentDate = req.body.assessmentDate;
    if ("slotId" in (req.body ?? {})) patch.slotId = typeof req.body.slotId === "string" ? req.body.slotId.trim() : null;
    if ("slotLabel" in (req.body ?? {})) patch.slotLabel = typeof req.body.slotLabel === "string" ? req.body.slotLabel.trim() : null;
    if (typeof req.body?.enabled === "boolean") patch.enabled = req.body.enabled;
    if (Array.isArray(req.body?.academyUserIds)) patch.academyUserIds = parseUserIds(req.body);
    try {
      if ("startsAt" in (req.body ?? {})) {
        const s = parseOptionalDate(req.body.startsAt, "startsAt");
        if (s !== undefined) patch.startsAt = s;
      }
      if ("expiresAt" in (req.body ?? {})) {
        const e = parseOptionalDate(req.body.expiresAt, "expiresAt");
        if (e !== undefined) patch.expiresAt = e;
      }
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Invalid date" });
      return;
    }

    const batch = await updateRegistrationBatch(id, patch);
    if (!batch) { res.status(404).json({ error: "Batch not found" }); return; }
    res.json({ batch });
  } catch (err) {
    req.log.error({ err }, "Failed to update registration batch");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// DELETE /api/admin/registration-batches/:id
router.delete("/admin/registration-batches/:id", async (req, res) => {
  try {
    if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
    const ok = await deleteRegistrationBatch(id);
    if (!ok) { res.status(404).json({ error: "Batch not found" }); return; }
    res.json({ ok: true, id });
  } catch (err) {
    req.log.error({ err }, "Failed to delete registration batch");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
