import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("./genaiHumanInterviewSchema.ts", import.meta.url), "utf8");

function load(execute) {
  const executable = ts.transpileModule(
    source.replace(/^import .*;\n/gm, "").replace("export function", "function"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const context = vm.createContext({
    db: { execute },
    sql: (parts) => parts.join(""),
  });
  vm.runInContext(`${executable}\nthis.ensure = ensureGenaiHumanInterviewSchema;`, context);
  return context.ensure;
}

test("concurrent reads create the table and index once without deleting results", async () => {
  const statements = [];
  const ensure = load(async (statement) => { statements.push(statement); });
  await Promise.all([ensure(), ensure(), ensure()]);
  await ensure();
  assert.equal(statements.length, 2);
  assert.match(statements[0], /CREATE TABLE IF NOT EXISTS genai_human_interview_results/);
  assert.match(statements[1], /CREATE INDEX IF NOT EXISTS/);
  assert.doesNotMatch(statements.join(" "), /\b(DROP|DELETE|TRUNCATE)\b/i);
});

test("a failed schema setup can be retried", async () => {
  let calls = 0;
  const ensure = load(async () => {
    if (++calls === 1) throw new Error("temporary database failure");
  });
  await assert.rejects(ensure(), /temporary database failure/);
  await ensure();
  assert.equal(calls, 3);
});
