import "../../artifacts/api-server/src/load-env";
import { pool } from "../../lib/db/src/index";
import { refreshGenaiQualificationStatuses } from "../../artifacts/api-server/src/lib/genaiResults";
import { publishGenaiQualificationOutput } from "../../artifacts/api-server/src/lib/genaiQualificationOutput";

try {
  const sourceRows = await refreshGenaiQualificationStatuses();
  console.log(`Refreshed GenAI qualification output from ${sourceRows} assessment rows.`);
  const written = await publishGenaiQualificationOutput();
  console.log(`Wrote ${written} GenAI qualification rows to BigQuery.`);
} catch (error) {
  console.error("GenAI qualification write failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
} finally {
  await pool.end();
}
