import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadFunctions(file, names, globals) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter((n) => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
  const js = ts.transpileModule(functions.map((n) => n.getText(ast)).join("\n"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { exports: {}, ...globals };
  vm.runInNewContext(js, context);
  return context.exports;
}

const { isDashboardStatusEligible, isIrpEligibleStatus, normalizeAccessStatus, normalizeIrpEligibleStatus } =
  loadFunctions("./academyUserProfile.ts", [
    "isDashboardStatusEligible",
    "isIrpEligibleStatus",
    "normalizeAccessStatus",
    "normalizeIrpEligibleStatus",
  ], { ELIGIBLE: "ELIGIBLE" });

const { diffSyncedAccess, hasDashboardAccess } = loadFunctions(
  "./dashboardAccessLog.ts",
  ["diffSyncedAccess", "hasDashboardAccess"],
  { isDashboardStatusEligible, isIrpEligibleStatus, normalizeAccessStatus, normalizeIrpEligibleStatus },
);

const OPEN = { irpEligibleStatus: "ELIGIBLE", lpStatus: "ACTIVE", productStatus: "ACTIVE" };

test("access follows the three statuses, with admin override always granting", () => {
  assert.equal(hasDashboardAccess(OPEN, false), true);
  assert.equal(hasDashboardAccess({ ...OPEN, lpStatus: "EXPIRED" }, false), false);
  assert.equal(hasDashboardAccess({ ...OPEN, lpStatus: "EXPIRED" }, true), true);
  assert.equal(hasDashboardAccess(null, false), false);
});

test("sync diff logs only real flips and first-seen students", () => {
  const snapshot = {
    statuses: new Map([
      ["stays-yes", OPEN],
      ["lost", OPEN],
      ["gained", { ...OPEN, productStatus: "EXPIRED" }],
      ["override", { ...OPEN, lpStatus: "REVOKED" }],
    ]),
    overrides: new Set(["override"]),
  };
  const changes = diffSyncedAccess(snapshot, [
    { userId: "stays-yes", ...OPEN },
    { userId: "lost", ...OPEN, lpStatus: "EXPIRED" },
    { userId: "gained", ...OPEN },
    { userId: "override", ...OPEN, productStatus: "REFUNDED" },
    { userId: "new-student", ...OPEN, irpEligibleStatus: "NOT_ELIGIBLE" },
  ]);
  const byId = Object.fromEntries(changes.map((c) => [c.userId, c]));
  assert.deepEqual(Object.keys(byId).sort(), ["gained", "lost", "new-student"]);
  assert.equal(byId.lost.fromAccess, true);
  assert.equal(byId.lost.toAccess, false);
  assert.equal(byId.lost.before.lpStatus, "ACTIVE");
  assert.equal(byId.lost.after.lpStatus, "EXPIRED");
  assert.equal(byId.gained.fromAccess, false);
  assert.equal(byId.gained.toAccess, true);
  assert.equal(byId["new-student"].fromAccess, null);
  assert.equal(byId["new-student"].toAccess, false);
  assert.ok(changes.every((c) => c.source === "daily_sync"));
});
