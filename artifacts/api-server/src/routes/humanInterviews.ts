import { Router } from "express";
import {
  GetHumanInterviewResultsResponse,
  GetHumanInterviewSyncStatusResponse,
  SyncHumanInterviewResultsResponse,
} from "@workspace/api-zod";
import { checkApiKey } from "../lib/apiKey";
import { resolveAcademyUserId } from "../lib/auth";
import { getVisibilitySettings, toResponse } from "../lib/visibilitySettings";
import { getHumanInterviewsForUser, getHumanInterviewSyncStatus, syncHumanInterviews, isNexusConfigured } from "../lib/humanInterviews";

const router = Router();

router.get("/student/human-interviews", async (req, res): Promise<void> => {
  try {
    const uid = await resolveAcademyUserId(req);
    if (!uid) { res.status(401).json({ error: "Unauthorized" }); return; }
    res.setHeader("Cache-Control", "private, no-store");
    const settings = await getVisibilitySettings();
    const released = toResponse(settings.map, settings.releaseAtByKey, settings.updatedAt).humanInterviewResults;
    if (!released) {
      res.json(GetHumanInterviewResultsResponse.parse({ attempts: [], latestResult: null, syncedAt: null, released: false }));
      return;
    }
    const results = await getHumanInterviewsForUser(uid);
    res.json(GetHumanInterviewResultsResponse.parse({ ...results, released: true }));
  } catch (err) {
    req.log.error({ err }, "Failed to read human interview results");
    res.status(500).json({ error: "Could not load human interview results" });
  }
});

router.get("/admin/human-interviews/status", async (req, res): Promise<void> => {
  if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    res.setHeader("Cache-Control", "private, no-store");
    res.json(GetHumanInterviewSyncStatusResponse.parse(await getHumanInterviewSyncStatus()));
  } catch (err) {
    req.log.error({ err }, "Failed to read human interview sync status");
    res.status(500).json({ error: "Could not load interview sync status" });
  }
});

router.post("/admin/human-interviews/sync", async (req, res): Promise<void> => {
  if (!checkApiKey(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!isNexusConfigured()) {
    res.status(503).json({ error: "Academy Nexus key is not configured on the server" });
    return;
  }
  try {
    await syncHumanInterviews();
    res.json(SyncHumanInterviewResultsResponse.parse(await getHumanInterviewSyncStatus()));
  } catch (err) {
    req.log.error({ err }, "Human interview sync failed; previous results retained");
    res.status(502).json({ error: "Interview fetch failed. Previous results have been kept. Please retry shortly." });
  }
});

export default router;
