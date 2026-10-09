import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const uiDir = fileURLToPath(new URL("../../../irp-dashboard/", import.meta.url));
const require = createRequire(`${uiDir}/package.json`);
const accessSource = readFileSync(`${uiDir}/src/lib/useStudentAccess.ts`, "utf8");
const hookFixtures = {
  useL1Registration: "export function useL1Registration(){return {registration:null,submit:()=>{},isSubmitted:false,submitting:false}}",
  useL1ExamAccess: "export function useL1ExamAccess(){return {examAccess:null}}",
  useL1July12Cohort: "export function useL1July12Cohort(){return {registered:false,registrationUnlocked:false}}",
  useL1July26Allowlist: "export function useL1July26Allowlist(){return {allowed:false}}",
  useRegistrationBatch: 'export function formatRegistrationBatchDate(){return ""};export function useRegistrationBatch(){return {batch:null}}',
  // Use the real live-window/filter helpers, replacing only the network/query hook.
  useStudentAccess: accessSource.slice(0, accessSource.indexOf("export function useStudentAccess()")) +
    "export function useStudentAccess(){const grants=(globalThis.__feHubTestGrants??[]).filter(g=>!isAssessmentWindowEnded(g.expiresAt));return {grants,loading:false,findGrant:(stage,kind)=>findAccessGrant(grants,stage,kind)}}",
};
const compiled = await build({
  stdin: {
    contents: 'import React from "react";import {renderToStaticMarkup} from "react-dom/server";import {AssessmentsHub} from "./src/pages/AssessmentsHub";export const render=(props)=>renderToStaticMarkup(React.createElement(AssessmentsHub,props));',
    resolveDir: uiDir, loader: "tsx",
  },
  bundle: true, write: false, platform: "node", format: "cjs",
  define: { "import.meta.env": "{}" },
  jsx: "automatic",
  external: ["react", "react-dom/server", "react/jsx-runtime"],
  alias: { "@": `${uiDir}/src` },
  plugins: [{
    name: "hub-hook-fixtures",
    setup(b) {
      b.onResolve({ filter: /^@\/lib\/use/ }, (args) => {
        const name = args.path.split("/").pop();
        if (hookFixtures[name]) return { path: name, namespace: "fixture" };
      });
      b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: hookFixtures[args.path], loader: "ts" }));
      b.onResolve({ filter: /^@\/components\/irp\/(L1RegistrationModal|RegistrationBatchCallout|L1July25MockCallout|L1July26MainCallout)$/ },
        (args) => ({ path: args.path.split("/").pop(), namespace: "empty" }));
      b.onLoad({ filter: /.*/, namespace: "empty" },
        (args) => ({ contents: `export const ${args.path}=()=>null;`, loader: "ts" }));
    },
  }],
});
const mod = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(require, mod, mod.exports);
const online = {
  organisationAssessmentId: "round-wise:hustler", level: "L1", levelNumber: 1,
  assessmentStatus: "QUALIFIED", hasWrittenAssessment: true, overallScore: 90, overallMax: 100,
};
const props = {
  level: 1, userId: "fixture-user",
  journey: { journeyState: "L1_POST_ASSESSMENT", isWildcard: false }, assessments: [online],
};
const url = "https://assessment.topin.tech/assessment?org_id=fixture";
function grant(overrides = {}) {
  return {
    batchId: 34, name: "FE October", stage: "fe_project", linkKind: "main", url,
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(), ...overrides,
  };
}
function render(grants, pageProps = props) {
  globalThis.__feHubTestGrants = grants;
  try { return mod.exports.render(pageProps); }
  finally { delete globalThis.__feHubTestGrants; }
}
test("Hub shows live FE MAIN links", () => assert.ok(render([grant()]).includes(`href="${url}"`)));
test("Hub shows live FE MOCK links", () => assert.ok(render([grant({ linkKind: "mock" })]).includes(`href="${url}"`)));
test("Hub keeps scheduled FE links disabled", () => {
  const html = render([grant({ url: "", startsAt: new Date(Date.now() + 3_600_000).toISOString() })]);
  assert.ok(html.includes('disabled=""'));
  assert.ok(!html.includes(url));
});
test("Hub hides expired FE links", () => assert.ok(!render([grant({ expiresAt: new Date(Date.now() - 1000).toISOString() })]).includes(url)));
test("Hub does not invent an FE link without a grant", () => assert.ok(!render([]).includes(url)));
test("FE MAIN retains the L1 qualification gate", () => assert.ok(!render([grant()], { ...props, assessments: [] }).includes(url)));
test("FE MAIN stays hidden after FE qualification", () => {
  const qualifiedFe = { organisationAssessmentId: "fe-main", level: "L1 FE-PROJECT", cycle: "A2",
    assessmentStatus: "QUALIFIED", hasWrittenAssessment: true, overallScore: 100, overallMax: 100 };
  assert.ok(!render([grant()], { ...props, assessments: [online, qualifiedFe] }).includes(url));
});
