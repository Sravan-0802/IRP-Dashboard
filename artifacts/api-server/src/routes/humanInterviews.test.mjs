import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import express from "express";
import { build } from "esbuild";

const corePath = fileURLToPath(new URL("../lib/humanInterviewData.ts", import.meta.url));
globalThis.__hiRouteFixture = {};
const compiled = await build({
  entryPoints: [fileURLToPath(new URL("./humanInterviews.ts", import.meta.url))],
  bundle: true, platform: "node", format: "cjs", write: false, external: ["express"],
  plugins: [{
    name: "route-fixtures",
    setup(build) {
      build.onResolve({ filter: /^\.\.\/lib\/(apiKey|auth|visibilitySettings|humanInterviews)$/ }, ({ path }) =>
        ({ path: path.split("/").at(-1), namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        loader: "js",
        resolveDir: fileURLToPath(new URL(".", import.meta.url)),
        contents: {
          apiKey: `export const checkApiKey = req => req.headers["x-api-key"] === "unit-test-admin";`,
          auth: `export const resolveAcademyUserId = async req => req.headers["x-test-student"] || null;`,
          visibilitySettings: `
            export async function getVisibilitySettings(){return {map:{},releaseAtByKey:{},updatedAt:null};}
            export function toResponse(){return {humanInterviewResults:globalThis.__hiRouteFixture.released};}`,
          humanInterviews: `
            import { summarizeInterviews } from ${JSON.stringify(corePath)};
            export const isNexusConfigured = () => globalThis.__hiRouteFixture.configured;
            export async function getHumanInterviewsForUser(uid) {
              globalThis.__hiRouteFixture.reads++;
              const rows = globalThis.__hiRouteFixture.rows.filter(r=>r.candidateId===uid)
                .map(({candidateId,...attempt})=>attempt);
              return {...summarizeInterviews(rows),syncedAt:"2026-10-26T00:00:00Z"};
            }
            export async function syncHumanInterviews(){
              globalThis.__hiRouteFixture.syncs++;
              if(globalThis.__hiRouteFixture.failSync) throw new Error("upstream failed");
            }
            export async function getHumanInterviewSyncStatus(){
              return {configured:globalThis.__hiRouteFixture.configured,running:false,
                syncedAt:"2026-10-26T00:00:00Z",interviewCount:3,studentCount:2};
            }`,
        }[path],
      }));
    },
  }],
});
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(
  createRequire(import.meta.url), module, module.exports);
const app = express();
app.use((req, _res, next) => { req.log = { error() {} }; next(); });
app.use("/api", module.exports.default);
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
after(() => new Promise((resolve) => server.close(resolve)));
const admin = { "x-api-key": "unit-test-admin" };
const student = { "x-test-student": "student-a" };
const row = {
  candidateId: "student-a", interviewId: "a-older",
  interviewDate: "2026-10-01", interviewStartTime: "4:00 PM",
  part1Avg: 4, part2Avg: 4, part3Avg: 4, communicationRating: null,
  finalScore: 4, clearanceStatus: "Cleared",
};
beforeEach(() => {
  globalThis.__hiRouteFixture = {
    released: true, configured: true, reads: 0, syncs: 0, failSync: false,
    rows: [
      row,
      { ...row, interviewId: "a-new", interviewDate: "2026-10-02", finalScore: 2, clearanceStatus: "Not Cleared" },
      { ...row, interviewId: "b-only", candidateId: "student-b" },
    ],
  };
});

test("student results require authentication", async () => {
  const response = await fetch(`${base}/student/human-interviews`);
  assert.equal(response.status, 401);
  assert.equal(globalThis.__hiRouteFixture.reads, 0);
});
test("student results derive UID from auth, ignore a different UID in query, and omit private identity", async () => {
  const response = await fetch(`${base}/student/human-interviews?candidateId=student-b`, { headers: student });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.attempts.length, 2);
  assert.equal(body.latestResult.interviewId, "a-new");
  assert.equal(body.latestResult.clearanceStatus, "Not Cleared");
  assert.ok(body.attempts.every(a => !("candidateId" in a) && a.interviewId !== "b-only"));
});
test("unreleased results expose no scores and do not read student mirror rows", async () => {
  globalThis.__hiRouteFixture.released = false;
  const body = await (await fetch(`${base}/student/human-interviews`, { headers: student })).json();
  assert.deepEqual(body, { attempts: [], latestResult: null, syncedAt: null, released: false });
  assert.equal(globalThis.__hiRouteFixture.reads, 0);
});
test("empty student history stays empty", async () => {
  const body = await (await fetch(`${base}/student/human-interviews`, {
    headers: { "x-test-student": "student-with-no-results" },
  })).json();
  assert.deepEqual(body.attempts, []);
  assert.equal(body.latestResult, null);
});
test("admin status and fetch both reject missing or incorrect keys", async () => {
  for (const [path, method] of [["status", "GET"], ["sync", "POST"]]) {
    assert.equal((await fetch(`${base}/admin/human-interviews/${path}`, { method })).status, 401);
    assert.equal((await fetch(`${base}/admin/human-interviews/${path}`, {
      method, headers: { "x-api-key": "wrong" },
    })).status, 401);
  }
  assert.equal(globalThis.__hiRouteFixture.syncs, 0);
});
test("fetch reports configuration errors without contacting upstream", async () => {
  globalThis.__hiRouteFixture.configured = false;
  assert.equal((await fetch(`${base}/admin/human-interviews/sync`, { method: "POST", headers: admin })).status, 503);
  assert.equal(globalThis.__hiRouteFixture.syncs, 0);
});
test("failed fetch reports kept results; repeated successful syncs do not change release state", async () => {
  globalThis.__hiRouteFixture.failSync = true;
  const failed = await fetch(`${base}/admin/human-interviews/sync`, { method: "POST", headers: admin });
  assert.equal(failed.status, 502);
  assert.match((await failed.json()).error, /Previous results have been kept/);
  globalThis.__hiRouteFixture.failSync = false;
  globalThis.__hiRouteFixture.released = false;
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${base}/admin/human-interviews/sync`, { method: "POST", headers: admin });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).interviewCount, 3);
    assert.equal(globalThis.__hiRouteFixture.released, false);
  }
});
