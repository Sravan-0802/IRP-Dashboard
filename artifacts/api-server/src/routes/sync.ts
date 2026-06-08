import { Router } from "express";
import { db, bigquerySyncStatusTable } from "@workspace/db";
import { runBigQuerySync } from "../lib/sync-bigquery";
import { isBigQueryConfigured } from "../lib/bigquery";

const router = Router();

function checkApiKey(req: {
  headers: Record<string, string | string[] | undefined>;
}): boolean {
  const secret = process.env["TOKEN_SECRET"];
  if (!secret) return false;
  const authHeader = req.headers["authorization"];
  const bearer =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
  const apiKey = (req.headers["x-api-key"] as string) || bearer;
  return apiKey === secret;
}

// POST /api/sync/bigquery — manually trigger a sync (protected by API key)
router.post("/sync/bigquery", async (req, res) => {
  try {
    if (!checkApiKey(req as never)) {
      return void res.status(401).json({ message: "Unauthorized" });
    }
    if (!isBigQueryConfigured()) {
      return void res
        .status(503)
        .json({ message: "BigQuery is not configured on the server" });
    }

    const result = await runBigQuerySync();
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    req.log.error({ err }, "Manual BigQuery sync failed");
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/sync/status — last sync status per table (protected by API key)
router.get("/sync/status", async (req, res) => {
  try {
    if (!checkApiKey(req as never)) {
      return void res.status(401).json({ message: "Unauthorized" });
    }
    const rows = await db.select().from(bigquerySyncStatusTable);
    res.json({
      configured: isBigQueryConfigured(),
      tables: rows.map((r) => ({
        tableName: r.tableName,
        status: r.status,
        rowCount: r.rowCount,
        durationMs: r.durationMs,
        error: r.error,
        lastSyncedAt: r.lastSyncedAt ? r.lastSyncedAt.toISOString() : null,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get sync status");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
