import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./genaiProjectChoices.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { loadProjectChoices, saveProjectChoices, normalizeProjectChoices } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const available = ["Intelligent RAG Challenge", "Agentic RAG Challenge", "Building & Optimizing RAG Challenge"];

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("saved choices restore on return and remain isolated by account", () => {
  const storage = memoryStorage();
  saveProjectChoices(storage, "student-a", available.slice(0, 2), available);
  assert.deepEqual(loadProjectChoices(storage, "student-a", available), available.slice(0, 2));
  assert.deepEqual(loadProjectChoices(storage, "student-b", available), []);
  saveProjectChoices(storage, "student-b", [available[2]], available);
  assert.deepEqual(loadProjectChoices(storage, "student-a", available), available.slice(0, 2));
});

test("students can remove, replace, and clear all saved choices", () => {
  const storage = memoryStorage();
  for (const choices of [available.slice(0, 2), [available[1]], available.slice(1), []]) {
    saveProjectChoices(storage, "student-a", choices, available);
    assert.deepEqual(loadProjectChoices(storage, "student-a", available), choices);
  }
});

test("only two unique current catalogue entries can be restored or saved", () => {
  assert.deepEqual(normalizeProjectChoices([...available, available[0]], available), available.slice(0, 2));
  assert.deepEqual(normalizeProjectChoices([null, 3, "obsolete", available[1], available[1]], available), [available[1]]);
  for (const value of [null, {}, "project", 2]) {
    assert.deepEqual(normalizeProjectChoices(value, available), []);
  }
  const storage = memoryStorage();
  saveProjectChoices(storage, "student-a", available, available);
  assert.equal(loadProjectChoices(storage, "student-a", available).length, 2);
});

test("malformed browser data can be replaced and unavailable storage fails explicitly", () => {
  const storage = memoryStorage();
  const corrupt = { ...storage, getItem: () => "not-json" };
  assert.deepEqual(loadProjectChoices(corrupt, "student-a", available), []);
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("quota"); },
  };
  assert.throws(() => loadProjectChoices(blocked, "student-a", available), /blocked/);
  assert.throws(() => saveProjectChoices(blocked, "student-a", [], available), /quota/);
});
