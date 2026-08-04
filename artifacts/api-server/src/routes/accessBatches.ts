import { Router } from "express";
import { checkApiKey } from "../lib/apiKey";
import {
  ACCESS_STAGES,
  createAccessBatch,
  deleteAccessBatch,
  getAccessBatch,
  getAccessPreviewForUser,
  isAccessStage,
  listAccessBatches,
  normalizeLinkKind,
  parseOptionalDate,
  updateAccessBatch,
} from "../lib/accessBatches";

const router = Router();

function parseUserIds(body: unknown): string[] {
  const raw = (body as { academyUserIds?: unknown })?.academyUserIds;
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  ];
}

// GET /api/admin/access-batches
router.get("/admin/access-batches", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const batches = await listAccessBatches();
    res.json({ batches, stages: ACCESS_STAGES });
  } catch (err) {
    req.log.error({ err }, "Failed to list access batches");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/access-preview/:academyUserId — master viewer for one UID
router.get("/admin/access-preview/:academyUserId", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const academyUserId = String(req.params["academyUserId"] ?? "").trim();
    if (!academyUserId) {
      res.status(400).json({ error: "academyUserId is required" });
      return;
    }
    const preview = await getAccessPreviewForUser(academyUserId);
    res.json(preview);
  } catch (err) {
    req.log.error({ err }, "Failed to get access preview");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/access-batches/:id
router.get("/admin/access-batches/:id", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Invalid batch id" });
      return;
    }
    const batch = await getAccessBatch(id);
    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }
    res.json({ batch });
  } catch (err) {
    req.log.error({ err }, "Failed to get access batch");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/access-batches
router.post("/admin/access-batches", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const stageRaw =
      typeof req.body?.stage === "string" ? req.body.stage.trim() : "";
    const linkKindRaw =
      typeof req.body?.linkKind === "string" ? req.body.linkKind.trim() : "";
    const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : null;
    const academyUserIds = parseUserIds(req.body);

    let startsAt: Date | null = null;
    try {
      const parsed = parseOptionalDate(
        "startsAt" in (req.body ?? {}) ? req.body.startsAt : null,
        "startsAt",
      );
      startsAt = parsed === undefined ? null : parsed;
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Invalid startsAt" });
      return;
    }

    let expiresAt: Date | null = null;
    try {
      const parsed = parseOptionalDate(
        "expiresAt" in (req.body ?? {}) ? req.body.expiresAt : null,
        "expiresAt",
      );
      expiresAt = parsed === undefined ? null : parsed;
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Invalid expiresAt" });
      return;
    }

    if (!isAccessStage(stageRaw)) {
      res.status(400).json({
        error: `stage must be one of: ${ACCESS_STAGES.join(", ")}`,
      });
      return;
    }
    const linkKind = normalizeLinkKind(stageRaw, linkKindRaw || "default");
    if (!linkKind) {
      res.status(400).json({
        error: "linkKind must be mock or main for online_assessment and fe_project",
      });
      return;
    }
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    const batch = await createAccessBatch({
      name,
      stage: stageRaw,
      linkKind,
      url,
      academyUserIds,
      startsAt,
      expiresAt,
      createdBy: "api_key",
    });
    res.status(201).json({ batch });
  } catch (err) {
    req.log.error({ err }, "Failed to create access batch");
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// PUT /api/admin/access-batches/:id
router.put("/admin/access-batches/:id", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Invalid batch id" });
      return;
    }

    const patch: {
      name?: string | null;
      url?: string;
      enabled?: boolean;
      startsAt?: Date | null;
      expiresAt?: Date | null;
      academyUserIds?: string[];
    } = {};

    if ("name" in (req.body ?? {})) {
      patch.name =
        typeof req.body.name === "string" ? req.body.name.trim() : null;
    }
    if (typeof req.body?.url === "string") patch.url = req.body.url;
    if (typeof req.body?.enabled === "boolean") patch.enabled = req.body.enabled;
    if (Array.isArray(req.body?.academyUserIds)) {
      patch.academyUserIds = parseUserIds(req.body);
    }
    if ("startsAt" in (req.body ?? {})) {
      try {
        const parsed = parseOptionalDate(req.body.startsAt, "startsAt");
        if (parsed !== undefined) patch.startsAt = parsed;
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Invalid startsAt" });
        return;
      }
    }
    if ("expiresAt" in (req.body ?? {})) {
      try {
        const parsed = parseOptionalDate(req.body.expiresAt, "expiresAt");
        if (parsed !== undefined) patch.expiresAt = parsed;
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Invalid expiresAt" });
        return;
      }
    }

    const batch = await updateAccessBatch(id, patch);
    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }
    res.json({ batch });
  } catch (err) {
    req.log.error({ err }, "Failed to update access batch");
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// DELETE /api/admin/access-batches/:id
router.delete("/admin/access-batches/:id", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Invalid batch id" });
      return;
    }
    const ok = await deleteAccessBatch(id);
    if (!ok) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }
    res.json({ ok: true, id });
  } catch (err) {
    req.log.error({ err }, "Failed to delete access batch");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
