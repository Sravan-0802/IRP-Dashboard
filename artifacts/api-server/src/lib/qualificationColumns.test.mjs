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

const { buildGenaiQualificationOutput, genaiOutputWarehouseRows } = functions(
  "./genaiQualificationOutput.ts", ["buildGenaiQualificationOutput", "genaiOutputWarehouseRows"],
);
const genaiSource = {
  id: 1, userId: "student", assessmentTag: "GENAI_A1", assessmentTitle: "GenAI 'A1'",
  qualificationStatus: "QUALIFIED", attemptNumber: 1,
  userAssessmentStartDatetime: new Date("2026-10-01"), assessmentStartDatetime: null,
  syncedAt: new Date("2026-10-02"),
};

test("GenAI output keeps latest attempt, not best result or sync order", () => {
  const newer = { ...genaiSource, id: 2, qualificationStatus: "NOT_QUALIFIED",
    userAssessmentStartDatetime: new Date("2026-10-03"), attemptNumber: 2 };
  for (const rows of [[newer, genaiSource], [genaiSource, newer]]) {
    const output = buildGenaiQualificationOutput(rows);
    assert.equal(output.length, 1);
    assert.equal(output[0].qualificationStatus, "NOT_QUALIFIED");
    assert.equal(output[0].assessmentSpecificTag, "GENAI_A1");
  }
});

test("GenAI output separates students, tags and titles and preserves nullable identifiers", () => {
  const output = buildGenaiQualificationOutput([
    genaiSource, { ...genaiSource, userId: "other" }, { ...genaiSource, assessmentTag: "GENAI_A2" },
    { ...genaiSource, assessmentTitle: "Other title" },
    { ...genaiSource, assessmentTag: null, assessmentTitle: null },
    { ...genaiSource, id: 2, assessmentTag: null, assessmentTitle: null },
  ]);
  assert.equal(output.length, 5);
  const warehouse = genaiOutputWarehouseRows(output);
  assert.equal(Object.keys(warehouse[0]).join(","), "user_id,assessment_specific_tag,assessment_title,qualification_status");
  assert.equal(warehouse[0].assessment_title, "GenAI 'A1'");
  assert.equal(warehouse[4].assessment_specific_tag, null);
  assert.throws(() => buildGenaiQualificationOutput([{ ...genaiSource, qualificationStatus: null }]));
});

test("GenAI write-back is parameterized, batched, idempotent and reports failures", async () => {
  const queries = [];
  const output = Array.from({ length: 501 }, (_, i) => ({
    userId: `student-${i}`, assessmentSpecificTag: "GENAI_A1",
    assessmentTitle: "A1", qualificationStatus: "QUALIFIED",
  }));
  let fail = false;
  const dataset = {
    table: () => ({ getMetadata: async () => [{ schema: { fields: [
      "user_id", "assessment_specific_tag", "assessment_title", "qualification_status",
    ].map(name => ({ name, type: "STRING" })) } }] }),
    getMetadata: async () => [{ location: "asia-south1" }],
  };
  const { publishGenaiQualificationOutput } = functions("./genaiQualificationOutput.ts",
    ["publishGenaiQualificationOutput"], {
      db: { select: () => ({ from: async () => output }) },
      irpGenaiAssessmentQualificationStatusesTable: {},
      genaiOutputWarehouseRows,
      GENAI_QUALIFICATION_OUTPUT_TABLE: "project.dataset.output",
      logger: { info: () => {} },
      getBigQueryClient: () => ({ dataset: () => dataset, query: async options => {
        queries.push(options);
        if (fail) throw new Error("Write denied");
      } }),
    });
  assert.equal(await publishGenaiQualificationOutput(), 501);
  assert.equal(queries.length, 2);
  assert.equal(JSON.parse(queries[0].params.rows).length, 500);
  assert.equal(JSON.parse(queries[1].params.rows).length, 1);
  assert.match(queries[0].query, /MERGE/);
  assert.match(queries[0].query, /IS NOT DISTINCT FROM/);
  assert.doesNotMatch(queries[0].query, /DELETE|TRUNCATE|student-0/);
  assert.equal(queries[0].location, "asia-south1");
  fail = true;
  await assert.rejects(publishGenaiQualificationOutput(), /Write denied/);
});
