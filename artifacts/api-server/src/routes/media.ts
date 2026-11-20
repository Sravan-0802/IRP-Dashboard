import { Router, type IRouter } from "express";
import { boundedMediaRange, fetchLoomRange } from "../lib/mediaRanges";

/**
 * Public media proxy. Google Drive sets Cross-Origin-Resource-Policy: same-site on
 * direct MP4 downloads, so browsers block <video src="https://drive...">.
 * Proxying through our API keeps native play / volume / seek controls working.
 */
const router: IRouter = Router();

router.get("/media/loom-guidelines", async (req, res): Promise<void> => {
  const range = boundedMediaRange(req.method === "HEAD" ? "bytes=0-0" : req.headers.range);
  if (!range) {
    res.status(416).end();
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const cancel = () => controller.abort();
  res.once("close", cancel);
  try {
    const chunk = await fetchLoomRange(range, controller.signal);
    res.setHeader("Accept-Ranges", "bytes");
    if (chunk.status === 416) {
      if (chunk.contentRange) res.setHeader("Content-Range", chunk.contentRange);
      res.status(416).end();
      return;
    }
    res.setHeader("Content-Type", chunk.type);
    res.setHeader("Cache-Control", "private, max-age=300");
    if (req.method === "HEAD") {
      res.setHeader("Content-Length", chunk.total);
      res.status(200).end();
    } else {
      res.setHeader("Content-Range", chunk.contentRange);
      res.setHeader("Content-Length", chunk.body.length);
      res.status(206);
      res.write(chunk.body);
      res.end();
    }
  } catch (err) {
    if (!res.destroyed) {
      req.log.error({ err, range }, "Loom video chunk request failed");
      res.status(502).json({ error: "Failed to stream Loom guide video" });
    }
  } finally {
    clearTimeout(timeout);
    res.off("close", cancel);
  }
});

export default router;
