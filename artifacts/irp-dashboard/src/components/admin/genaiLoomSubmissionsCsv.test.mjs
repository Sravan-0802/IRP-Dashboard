import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./genaiLoomSubmissionsCsv.ts", import.meta.url), "utf8");
const panelSource = await readFile(new URL("./GenaiLoomSubmissionsPanel.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { buildSubmissionsCsv } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const header = [
  '"Student name"',
  '"Academy user ID"',
  '"Project"',
  '"Last updated (ISO)"',
  '"Loom URL"',
].join(",");

test("CSV header and rows keep every submission detail aligned", () => {
  const records = [
    {
      studentName: "Asha Patel",
      academyUserId: "academy-user-17",
      projectTitle: "Intelligent RAG Challenge",
      updatedAt: "2026-10-31T12:45:00.000Z",
      loomUrl: "https://www.loom.com/share/asha-video",
    },
    {
      studentName: "Leo Chen",
      academyUserId: "academy-user-42",
      projectTitle: "Agentic RAG Challenge",
      updatedAt: "2026-11-01T08:15:30.000Z",
      loomUrl: "https://www.loom.com/share/leo-video",
    },
  ];

  assert.equal(
    buildSubmissionsCsv(records),
    `\uFEFF${header}\r\n"Asha Patel","academy-user-17","Intelligent RAG Challenge","2026-10-31T12:45:00.000Z","https://www.loom.com/share/asha-video"\r\n"Leo Chen","academy-user-42","Agentic RAG Challenge","2026-11-01T08:15:30.000Z","https://www.loom.com/share/leo-video"`,
  );
});

test("an empty submission list exports only the CSV header", () => {
  assert.equal(buildSubmissionsCsv([]), `\uFEFF${header}`);
});

test("the download uses the same records rendered in the submissions table", () => {
  assert.match(panelSource, /const records: LoomSubmissionRow\[\] = submissions\.data\?\.submissions \?\? \[\]/);
  assert.match(panelSource, /onClick=\{\(\) => downloadSubmissionsCsv\(records\)\}/);
  assert.match(panelSource, /records\.map\(\(record\) => \(/);
});
