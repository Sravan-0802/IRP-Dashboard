import { Router } from "express";
import { resolveAcademyUserId } from "../lib/auth";
import { getVisibilitySettings, toResponse } from "../lib/visibilitySettings";
import { isV2ReadEnabled, readMernTrackStatus } from "../lib/trackStatus";
import { legacy } from "../lib/trackStatusData";

const router = Router();

/**
 * The student's stage results from the new irp_v2 tables. `source: "legacy"` tells the dashboard to
 * keep working results out the old way (switch off, or the new tables are not usable right now).
 */
router.get("/student/track-status", async (req, res): Promise<void> => {
  try {
    const uid = await resolveAcademyUserId(req);
    if (!uid) { res.status(401).json({ error: "Unauthorized" }); return; }
    res.setHeader("Cache-Control", "private, no-store");
    if (!isV2ReadEnabled()) { res.json(legacy("disabled")); return; }
    const settings = await getVisibilitySettings();
    const humanInterviewReleased =
      toResponse(settings.map, settings.releaseAtByKey, settings.updatedAt).humanInterviewResults === true;
    res.json(await readMernTrackStatus(uid, { humanInterviewReleased }));
  } catch (err) {
    req.log.error({ err }, "Failed to read track status; dashboard keeps the old logic");
    res.json(legacy("unavailable"));
  }
});

export default router;
