import { Router } from "express";
import {
  GetGenaiHumanInterviewResultsResponse,
  GetGenaiHumanInterviewSyncStatusResponse,
  SyncGenaiHumanInterviewResultsResponse,
} from "@workspace/api-zod";
import { checkApiKey } from "../lib/apiKey";
import { resolveAcademyUserId } from "../lib/auth";
import { getVisibilitySettings, toResponse } from "../lib/visibilitySettings";
import { isNexusConfigured } from "../lib/humanInterviews";
import {
  getGenaiHumanInterviewsForUser,
  getGenaiHumanInterviewSyncStatus,
  getGenaiHumanInterviewStats,
  syncGenaiHumanInterviews,
} from "../lib/genaiHumanInterviews";

const router = Router();

router.get("/student/genai-human-interviews", async (req, res): Promise<void> => {
  try {
    const uid = await resolveAcademyUserId(req);
    if (!uid) { res.status(401).json({ error: "Unauthorized" }); return; }
    res.setHeader("Cache-Control", "private, no-store");
    const settings = await getVisibilitySettings();
    const released = toResponse(settings.map, settings.releaseAtByKey, settings.updatedAt).genaiHumanInterviewResults;
    if (!released) {
      res.json(GetGenaiHumanInterviewResultsResponse.parse({ attempts: [], latestResult: null, syncedAt: null, released: false }));
      return;
    }
    const results = await getGenaiHumanInterviewsForUser(uid);
    res.json(GetGenaiHumanInterviewResultsResponse.parse({ ...results, released: true }));
  } catch (err) {
    req.log.error({ err }, "Failed to read GenAI human interview results");
    res.status(500).json({ error: "Could not load GenAI human interview results" });
  }
});

router.get("/admin/genai-human-interviews/status", async (req, res): Promise<void> => {
  if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    res.setHeader("Cache-Control", "private, no-store");
    res.json(GetGenaiHumanInterviewSyncStatusResponse.parse(await getGenaiHumanInterviewSyncStatus()));
  } catch (err) {
    req.log.error({ err }, "Failed to read GenAI human interview sync status");
    res.status(500).json({ error: "Could not load GenAI interview sync status" });
  }
});

router.post("/admin/genai-human-interviews/sync", async (req, res): Promise<void> => {
  if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!isNexusConfigured()) {
    res.status(503).json({ error: "Academy Nexus key is not configured on the server" });
    return;
  }
  try {
    await syncGenaiHumanInterviews();
    res.json(SyncGenaiHumanInterviewResultsResponse.parse(await getGenaiHumanInterviewSyncStatus()));
  } catch (err) {
    req.log.error({ err }, "GenAI human interview sync failed; previous results retained");
    res.status(502).json({ error: "GenAI interview fetch failed. Previous results have been kept. Please retry shortly." });
  }
});

router.get("/admin/genai-human-interviews/stats", async (req, res): Promise<void> => {
  if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    res.setHeader("Cache-Control", "private, no-store");
    res.json(await getGenaiHumanInterviewStats());
  } catch (err) {
    req.log.error({ err }, "Failed to read GenAI human interview stats");
    res.status(500).json({ error: "Could not load GenAI interview stats" });
  }
});

export default router;
