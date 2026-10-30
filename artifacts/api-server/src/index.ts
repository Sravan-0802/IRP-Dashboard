import "./load-env";
import app from "./app";
import { logger } from "./lib/logger";
import { startBigQuerySyncScheduler } from "./lib/sync-bigquery";
import { refreshAssessmentQualificationStatuses } from "./lib/assessmentQualificationStatuses";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void refreshAssessmentQualificationStatuses()
    .then(() => logger.info("Assessment qualification statuses refreshed"))
    .catch((err) => logger.error({ err }, "Assessment qualification status refresh failed"));
  startBigQuerySyncScheduler();
});
