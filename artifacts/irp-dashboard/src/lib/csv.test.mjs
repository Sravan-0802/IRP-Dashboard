import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./csv.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { csvCell } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("formula-prefixed values are neutralized, including after leading whitespace", () => {
  for (const formula of ["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1:A2)", " \t=1+1", "\r\n@SUM(A1:A2)"]) {
    assert.equal(csvCell(formula), '"' + "'" + formula + '"');
  }
});

test("CSV quoting preserves commas, quotes, newlines, and ordinary values", () => {
  assert.equal(csvCell("ordinary value"), '"ordinary value"');
  assert.equal(csvCell("one, two"), '"one, two"');
  assert.equal(csvCell('She said "hello"'), '"She said ""hello"""');
  assert.equal(csvCell("first line\nsecond line"), '"first line\nsecond line"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
});
