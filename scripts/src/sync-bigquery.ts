import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runBigQuerySync } from "../../artifacts/api-server/src/lib/sync-bigquery";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(repoRoot, ".env");

for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const result = await runBigQuerySync();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
