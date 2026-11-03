import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadFunctions(file, names, globals) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
  const js = ts.transpileModule(functions.map(n => n.getText(ast)).join("\n"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { exports: {}, ...globals };
  vm.runInNewContext(js, context);
  return context.exports;
}

test("live query is scoped to authenticated identity, uncached, and rejects duplicates/errors", async () => {
  let options;
  let rows = [];
  let failure;
  const { fetchDashboardAccessStatuses } = loadFunctions("./bigquery.ts", ["fetchDashboardAccessStatuses"], {
    process: { env: { project_id: "test-project" } },
    getBigQueryClient: () => ({ query: async o => {
      options = o;
      if (failure) throw failure;
      return [rows];
    } }),
    resolveDataset: async () => "test_dataset",
    BASIC_DETAILS_POCS_TABLE: "pocs",
    BASIC_DETAILS_LEGACY_TABLE: "legacy",
    setTimeout, clearTimeout,
  });
  assert.equal(await fetchDashboardAccessStatuses("student-a"), null);
  assert.equal(options.params.userId, "student-a");
  assert.match(options.query, /WHERE user_id = @userId LIMIT 2/);
  assert.equal(options.useQueryCache, false);
  assert.equal(options.jobTimeoutMs, 10000);
  rows = [{ user_id: "student-a" }];
  assert.equal((await fetchDashboardAccessStatuses("student-a")).user_id, "student-a");
  rows.push({ user_id: "student-a" });
  await assert.rejects(fetchDashboardAccessStatuses("student-a"), /Ambiguous/);
  failure = new Error("warehouse unavailable");
  await assert.rejects(fetchDashboardAccessStatuses("student-a"), /warehouse unavailable/);
});

test("each access check loads fresh statuses; all three required, no stale fallback", async () => {
  let row;
  let calls = 0;
  let failure;
  const helpers = loadFunctions("./academyUserProfile.ts", [
    "normalizePaymentStatusValue", "normalizeIrpEligibleStatus", "normalizeAccessStatus",
    "isIrpEligibleStatus", "isDashboardStatusEligible", "getLiveAcademyUserDashboardAccess",
  ], {
    ELIGIBLE: "ELIGIBLE",
    require: () => ({ fetchDashboardAccessStatuses: async () => {
      calls++;
      if (failure) throw failure;
      return row;
    } }),
  });
  const get = helpers.getLiveAcademyUserDashboardAccess;
  row = { irp_eligible_status: " eligible ", lp_status: "active", product_status: "ACTIVE", payment_status: "UNPAID" };
  assert.equal((await get("student-a")).allowed, true);
  for (const field of ["irp_eligible_status", "lp_status", "product_status"]) {
    const saved = row[field];
    row[field] = null;
    assert.equal((await get("student-a")).allowed, false);
    row[field] = saved;
  }
  row.irp_eligible_status = "NOT_ELIGIBLE";
  assert.equal((await get("student-a")).allowed, false);
  row = null;
  assert.equal((await get("student-a")).allowed, false);
  failure = new Error("warehouse unavailable");
  await assert.rejects(get("student-a"), /warehouse unavailable/);
  assert.equal(calls, 7);
});
