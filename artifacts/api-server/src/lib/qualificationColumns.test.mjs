import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

function functions(file, names, globals = {}) {
  const text = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const source = ast.statements.filter(node =>
    ts.isFunctionDeclaration(node) && names.includes(node.name?.text),
  ).map(node => node.getText(ast)).join("\n");
  const context = { exports: {}, ...globals };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}

const fe = functions("./feQualification.ts", [
  "feAssessmentIndex", "identifiersOf", "requiredFePercentage", "getFeAssessmentStatus",
]);
const mocks = functions("./mainOnly.ts", ["isMockLabel", "isMockAssessmentFields"]);
const { detailedQualificationStatus: status } = functions("./assessmentQualificationStatuses.ts",
  ["assessmentFamily", "detailedQualificationStatus"], { ...fe, ...mocks });
const rule = (tag, fromNumber, minPercentage, toNumber = null) =>
  ({ id: tag, tag, fromNumber, toNumber, minPercentage });
const feRules = [rule("FE_PROJECT_A1", 1, 70, 1), rule("FE_PROJECT_A2", 2, 100, 2), rule("FE_PROJECT_A3", 3, 90)];
const l1Rules = [rule("HUSTLER_A1", 1, 75)];
const row = {
  assessmentTag: "ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A1", assessmentTitle: "FE Project",
  assessmentUserScore: 70, assessmentTotalScore: 100,
  userAssessmentStartDatetime: new Date(), level: null, cycle: "A1",
};

test("detailed column applies family-specific saved rules to each attempt", () => {
  assert.equal(status(row, feRules, l1Rules), "QUALIFIED");
  assert.equal(status({ ...row, assessmentUserScore: 69 }, feRules, l1Rules), "NOT QUALIFIED");
  assert.equal(status({ ...row, assessmentTag: "HUSTLER_A1", assessmentTitle: "Hustler" }, feRules, l1Rules), "NOT QUALIFIED");
  assert.equal(status({ ...row, assessmentTag: "A8", assessmentTitle: null, level: "L1", cycle: "A8", assessmentUserScore: 80 }, feRules, l1Rules), "QUALIFIED");
  assert.equal(status({ ...row, assessmentTag: "FE_PROJECT_A2", cycle: "A2", assessmentUserScore: 99 }, feRules, l1Rules), "NOT QUALIFIED");
  assert.equal(status({ ...row, assessmentTag: "FE_PROJECT_A2", cycle: "A2", assessmentUserScore: 100 }, feRules, l1Rules), "QUALIFIED");
});

test("exact tag overrides ranges and tag number precedes conflicting cycle", () => {
  const rules = [rule("SPECIAL_FE_PROJECT_A1", 1, 80), rule("RANGE", 1, 60)];
  assert.equal(status({ ...row, assessmentTag: "SPECIAL_FE_PROJECT_A1" }, rules, l1Rules), "NOT QUALIFIED");
  assert.equal(status({ ...row, assessmentTag: "FE_PROJECT_A2", cycle: "A1", assessmentUserScore: 70 }, feRules, l1Rules), "NOT QUALIFIED");
});

test("missing start is not attempted, mock/manual/unrecognized rows stay unscored", () => {
  assert.equal(status({ ...row, assessmentUserScore: 0, userAssessmentStartDatetime: null }, feRules, l1Rules), "NOT ATTEMPTED");
  assert.equal(status({ ...row, assessmentTag: "MOCK_FE_PROJECT_A1" }, feRules, l1Rules), null);
  assert.equal(status({ ...row, assessmentTag: null, assessmentTitle: "Manual dashboard access" }, feRules, l1Rules), null);
});

const { matchGenaiRule } = functions("./genaiQualificationRules.ts", ["matchGenaiRule"], { feAssessmentIndex: fe.feAssessmentIndex });
const { genaiAssessmentStatus } = functions("./genaiResults.ts", ["genaiAssessmentStatus"], { matchGenaiRule });
test("GenAI persisted status uses MCQ and coding thresholds from matching tag rules", () => {
  const rules = [{ id: "a1", tag: "GENAI_A1", fromNumber: 1, toNumber: null, minMcq: 25, minCoding: 48 }];
  const assessment = { attempted: 1, assessmentTag: "GENAI_A1", assessmentNumber: "A1", mcqScore: 25, codingScore: 48 };
  assert.equal(genaiAssessmentStatus(assessment, rules), "QUALIFIED");
  assert.equal(genaiAssessmentStatus({ ...assessment, codingScore: 47 }, rules), "NOT_QUALIFIED");
  assert.equal(genaiAssessmentStatus({ ...assessment, mcqScore: null, codingScore: null }, rules), "RESULT_PENDING");
  assert.equal(genaiAssessmentStatus({ ...assessment, attempted: 0 }, rules), "NOT_ATTEMPTED");
});
