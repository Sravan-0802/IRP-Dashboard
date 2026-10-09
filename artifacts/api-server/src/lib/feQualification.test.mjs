import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

async function loadSource(path, alias) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true, write: false, format: "esm", platform: "node", alias,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const { getFeAssessmentStatus } = await loadSource("./feQualification.ts");
const ui = await loadSource("../../../irp-dashboard/src/lib/assessment.ts", {
  "@": fileURLToPath(new URL("../../../irp-dashboard/src", import.meta.url)),
});
const display = await loadSource("../../../irp-dashboard/src/lib/studentStatusDisplay.ts", {
  "@": fileURLToPath(new URL("../../../irp-dashboard/src", import.meta.url)),
});
const started = "2026-10-09T06:30:00Z";
const cases = [
  ["A1", 69.99, started, "NOT QUALIFIED"],
  ["A1", 70, started, "QUALIFIED"],
  ["A1", 70, null, "QUALIFIED"],
  ["A1", 100, started, "QUALIFIED"],
  ["A2", 90, started, "NOT QUALIFIED"],
  ["A2", 99.99, started, "NOT QUALIFIED"],
  ["A2", 100, started, "QUALIFIED"],
  ["A2", 100.01, started, "NOT QUALIFIED"],
  ["A3", 89.99, started, "NOT QUALIFIED"],
  ["A3", 90, started, "QUALIFIED"],
  ["A4", 100, null, "QUALIFIED"],
  ["A5", 0, started, "NOT QUALIFIED"],
  ["A5", null, started, "NOT QUALIFIED"],
  ["A5", 0, null, "NOT ATTEMPTED"],
  ["A5", null, null, "NOT ATTEMPTED"],
  ["A2", 99.99, null, "NOT ATTEMPTED"],
  [null, 100, started, "NOT QUALIFIED"],
  [null, 100, null, "NOT ATTEMPTED"],
];
for (const [number, score, start, expected] of cases) {
  test(`FE CASE ${number} / ${score}% / ${start ? "started" : "not started"}`, () => {
    assert.equal(getFeAssessmentStatus(number, score, start), expected);
    const row = {
      organisationAssessmentId: "fe-test", level: "L1 FE-PROJECT",
      cycle: number, assessmentTag: number, assessmentStatus: expected,
      overallScore: score ?? 0, overallMax: 100,
      hasWrittenAssessment: expected !== "NOT ATTEMPTED",
    };
    assert.equal(ui.hasClearedFeSit(row, 18), expected === "QUALIFIED");
    assert.equal(ui.hasClearedFeProject([row], 18), expected === "QUALIFIED");
    assert.equal(display.formatFeProjectStatus(row),
      expected === "QUALIFIED" ? "Qualified" :
      expected === "NOT QUALIFIED" ? "Not qualified" : "Not attempted");
  });
}
test("legacy score rows use percentages, not a universal raw-score threshold", () => {
  const row = { organisationAssessmentId: "fe-test", level: "L1 FE-PROJECT",
    hasWrittenAssessment: true, overallMax: 20 };
  assert.equal(ui.hasClearedFeSit({ ...row, cycle: "A1", overallScore: 14 }), true);
  assert.equal(ui.hasClearedFeSit({ ...row, cycle: "A2", overallScore: 19 }), false);
  assert.equal(ui.hasClearedFeSit({ ...row, cycle: "A2", overallScore: 20 }), true);
  assert.equal(ui.hasClearedFeSit({ ...row, cycle: "A3", overallScore: 18 }), true);
  assert.equal(ui.hasClearedFeSit({ ...row, cycle: "A3", overallScore: 17.999 }), false);
});
