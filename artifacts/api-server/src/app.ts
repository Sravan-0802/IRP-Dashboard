import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    // Stable id for correlating a user's report with prod log lines.
    genReqId(req, res) {
      const incoming = req.headers["x-request-id"];
      const id =
        typeof incoming === "string" && incoming.trim()
          ? incoming.trim()
          : randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    // Log 4xx at warn and 5xx at error; keep successful traffic quieter in prod.
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  }),
);

// Expose request id early (also set in genReqId) so clients / support can quote it.
app.use((req: Request, res: Response, next: NextFunction) => {
  const id = req.id != null ? String(req.id) : "";
  if (id && !res.getHeader("X-Request-Id")) {
    res.setHeader("X-Request-Id", id);
  }
  next();
});

app.use(cors({
  exposedHeaders: ["X-Request-Id"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
