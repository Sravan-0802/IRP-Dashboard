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

test("payment-status grants bypass BigQuery, while normal users still use live statuses", async () => {
  const source = fs.readFileSync(new URL("../routes/student.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("student.ts", source, ts.ScriptTarget.Latest, true);
  const route = ast.statements.find(n => ts.isExpressionStatement(n) &&
    ts.isCallExpression(n.expression) && n.expression.arguments[0]?.text === "/student/payment-status");
  assert.ok(route, "payment-status route exists");
  let manual = true;
  let liveCalls = 0;
  let failLive = true;
  let identity = "internal-user";
  const context = {
    exports: {},
    require: () => ({ hasManualDashboardAccess: async () => manual }),
    resolveAcademyUserId: async () => identity,
    getLiveAcademyUserDashboardAccess: async () => {
      liveCalls++;
      if (failLive) throw new Error("warehouse unavailable");
      return { allowed: false, irpEligibleStatus: "NOT_ELIGIBLE" };
    },
  };
  vm.runInNewContext(ts.transpileModule(`exports.handler = ${route.expression.arguments[1].getText(ast)}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  const run = async () => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await context.exports.handler({ log: { error() {} } }, res);
    return res;
  };
  let result = await run();
  assert.equal(result.body.allowed, true);
  assert.equal(liveCalls, 0, "manual grant must never depend on warehouse availability");
  assert.equal(result.headers["Cache-Control"], "private, no-store");
  manual = false;
  result = await run();
  assert.equal(result.code, 500);
  failLive = false;
  result = await run();
  assert.equal(result.body.allowed, false);
  identity = null;
  result = await run();
  assert.equal(result.code, 401);
});

test("UID parser accepts newline, comma lists and headered or headerless CSV", () => {
  const { parseAcademyUserIds: parse } = loadFunctions(
    "../../../irp-dashboard/src/lib/parseAcademyUserIds.ts", ["parseAcademyUserIds"], {},
  );
  const a = "00000000-0000-4000-8000-000000000001";
  const b = "00000000-0000-4000-8000-000000000002";
  for (const input of [`${a},${b}`, `${a}\n${b}`, `academy_user_id,name\n${a},First\n${b},Second`, `${a},First\n${b},Second`]) {
    assert.deepEqual([...parse(input)], [a, b]);
  }
  assert.deepEqual([...parse(`${a},${a}`)], [a]);
});
