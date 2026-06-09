import "./src/load-env.js";
import { runBigQuerySync } from "./src/lib/sync-bigquery.js";

const result = await runBigQuerySync();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
