import { Router, type IRouter } from "express";

/**
 * Public media proxy. Google Drive sets Cross-Origin-Resource-Policy: same-site on
 * direct MP4 downloads, so browsers block <video src="https://drive...">.
 * Proxying through our API keeps native play / volume / seek controls working.
 */
const LOOM_GUIDE_DRIVE_ID = "12CnEaVZ9m2Fwr13DRj_AdNyDnek4lrA4";
const LOOM_GUIDE_SOURCE = `https://drive.usercontent.google.com/download?id=${LOOM_GUIDE_DRIVE_ID}&export=download`;

const router: IRouter = Router();

router.get("/media/loom-guidelines", async (req, res) => {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "IRP-Dashboard/1.0",
    };
    const range = typeof req.headers.range === "string" ? req.headers.range : null;
    if (range) headers.Range = range;

    const upstream = await fetch(LOOM_GUIDE_SOURCE, { headers, redirect: "follow" });
    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).json({ error: "Failed to fetch Loom guide video" });
      return;
    }

    res.status(upstream.status);
    const contentType = upstream.headers.get("content-type") || "video/mp4";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) res.setHeader("Content-Range", contentRange);

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    res.on("close", () => {
      void reader.cancel().catch(() => undefined);
    });

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise<void>((resolve) => res.once("drain", resolve));
      }
    }
    res.end();
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to stream Loom guide video" });
    } else {
      res.end();
    }
  }
});

export default router;
