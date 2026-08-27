/**
 * Load repo-root .env then start the bundled API (Windows-friendly; load-env is not in the esbuild bundle).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
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
}

process.env.NODE_ENV = process.env.NODE_ENV ?? "development";

const child = spawn(
  process.execPath,
  ["--enable-source-maps", resolve(dirname(fileURLToPath(import.meta.url)), "dist/index.mjs")],
  { stdio: "inherit", env: process.env, cwd: dirname(fileURLToPath(import.meta.url)) },
);

child.on("exit", (code) => process.exit(code ?? 0));
