import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [new URL("./humanInterviewData.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", write: false,
});
const { summarizeInterviews, parseNexusPage, fetchNexusInterviews, interviewTimestamp } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const clearanceCompiled = await build({
  entryPoints: [new URL("../../../irp-dashboard/src/lib/humanInterviewClearance.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", write: false,
});
const { withHumanInterviewClearance } = await import(
  `data:text/javascript;base64,${Buffer.from(clearanceCompiled.outputFiles[0].text).toString("base64")}`);

function attempt(overrides = {}) {
  return {
    interviewId: "interview-1", candidateId: "test-academy-uid",
    interviewDate: "2026-10-10", interviewStartTime: "4:00 PM",
    part1Avg: 4, part2Avg: 3, part3Avg: null, communicationRating: null,
    finalScore: 3.5, clearanceStatus: "Cleared", ...overrides,
  };
}
function page(results, nextCursor = null) {
  return { template: "irp-l1", count: results.length, results, nextCursor };
}
const ok = (data) => new Response(JSON.stringify(data), { status: 200 });

test("keeps every attempt and uses latest result, not highest or any previous clearance", () => {
  const old = attempt({ interviewId: "old", finalScore: 5 });
  const latest = attempt({ interviewId: "latest", interviewDate: "2026-10-15", finalScore: 2, clearanceStatus: "Not Cleared" });
  const result = summarizeInterviews([old, latest]);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.latestResult.interviewId, "latest");
  assert.equal(result.latestResult.clearanceStatus, "Not Cleared");
});
test("newest scored pass clears even after a previous failed interview", () => {
  const result = summarizeInterviews([
    attempt({ interviewId: "old", finalScore: 1, clearanceStatus: "Not Cleared" }),
    attempt({ interviewId: "new", interviewDate: "2026-10-11", finalScore: 3.5 }),
  ]);
  assert.equal(result.latestResult.interviewId, "new");
  assert.equal(result.latestResult.clearanceStatus, "Cleared");
});
test("future, cancelled and unknown statuses never replace latest scored completion", () => {
  const rows = [attempt(), ...["scheduled", "no_show", "cancelled", "new_status", ""].map((clearanceStatus, i) =>
    attempt({ interviewId: `pending-${i}`, interviewDate: "2026-11-01", finalScore: null, clearanceStatus }))];
  assert.equal(summarizeInterviews(rows).attempts.length, 6);
  assert.equal(summarizeInterviews(rows).latestResult.interviewId, "interview-1");
  assert.equal(summarizeInterviews([attempt({ clearanceStatus: "unknown" })]).latestResult, null);
});
test("zero is a scored failure, not a missing score; null remains null", () => {
  const parsed = parseNexusPage(page([attempt({ finalScore: 0, clearanceStatus: "Not Cleared" })]));
  assert.equal(summarizeInterviews(parsed.results).latestResult.finalScore, 0);
  assert.equal(parsed.results[0].communicationRating, null);
});
test("same-day ordering parses 12AM, 12PM, and afternoon IST times correctly", () => {
  assert.ok(interviewTimestamp(attempt({ interviewStartTime: "4:00 PM" })) >
    interviewTimestamp(attempt({ interviewStartTime: "11:00 AM" })));
  assert.ok(interviewTimestamp(attempt({ interviewStartTime: "12:00 PM" })) >
    interviewTimestamp(attempt({ interviewStartTime: "12:00 AM" })));
  assert.equal(summarizeInterviews([
    attempt({ interviewId: "morning", interviewStartTime: "11:00 AM" }),
    attempt({ interviewId: "afternoon", interviewStartTime: "4:00 PM" }),
  ]).latestResult.interviewId, "afternoon");
});
test("empty response has no latest score", () => {
  assert.deepEqual(summarizeInterviews([]), { attempts: [], latestResult: null });
});
test("validates result pages, missing UIDs/IDs, and invalid scores before persistence", () => {
  assert.throws(() => parseNexusPage(page([attempt({ candidateId: "" })])));
  assert.throws(() => parseNexusPage(page([attempt({ interviewId: "" })])));
  assert.throws(() => parseNexusPage(page([attempt({ finalScore: 6 })])));
  assert.throws(() => parseNexusPage({ ...page([]), template: "other" }));
  assert.throws(() => parseNexusPage({ ...page([]), count: 5 }));
});
test("fetches all pages using cursors and sends API key only in headers", async () => {
  const calls = [];
  const rows = await fetchNexusInterviews("unit-test-key", async (url, options) => {
    calls.push({ url: new URL(url), options });
    return calls.length === 1
      ? ok(page([attempt()], "page-two"))
      : ok(page([attempt({ interviewId: "interview-2" })]));
  });
  assert.equal(rows.length, 2);
  assert.equal(calls[0].url.searchParams.get("template"), "irp-l1");
  assert.equal(calls[0].url.searchParams.get("limit"), "500");
  assert.equal(calls[1].url.searchParams.get("cursor"), "page-two");
  assert.equal(calls[0].options.headers["x-api-key"], "unit-test-key");
  assert.equal(calls[0].url.href.includes("unit-test-key"), false);
});
test("later-page failure rejects entire fetch rather than returning partial results", async () => {
  let n = 0;
  await assert.rejects(fetchNexusInterviews("test", async () => {
    n++;
    return n === 1 ? ok(page([attempt()], "next")) : new Response("Unauthorized", { status: 401 });
  }), /401/);
});
test("rejects pagination cycles and duplicate interview IDs", async () => {
  let n = 0;
  await assert.rejects(fetchNexusInterviews("test", async () =>
    ok(page([attempt({ interviewId: `id-${n++}` })], "cycle"))), /cursor/);
  await assert.rejects(fetchNexusInterviews("test", async () => ok(page([attempt()], "next"))), /duplicate/);
});

test("released latest clearance updates existing Human Interview clear card, not Level 2", () => {
  const steps = [
    { label: "Human Interview", status: "locked", icon: "human" },
    { label: "Level 2 Access", status: "locked", icon: "access" },
  ];
  const cleared = withHumanInterviewClearance(steps, { released: true, latestResult: attempt() });
  assert.equal(cleared[0].status, "done");
  assert.equal(cleared[0].badgeLabel, "Cleared");
  assert.equal(cleared[1], steps[1]);
  assert.equal(steps[0].status, "locked");
  const failed = withHumanInterviewClearance(steps, {
    released: true, latestResult: attempt({ finalScore: 0, clearanceStatus: "Not Cleared" }),
  });
  assert.equal(failed[0].status, "attempted_not_cleared");
  assert.equal(failed[0].badgeLabel, "Not cleared");
});
test("hidden or unscored results cannot change the clear card", () => {
  const steps = [{ label: "Human Interview", status: "locked", icon: "human" }];
  assert.equal(withHumanInterviewClearance(steps, { released: false, latestResult: attempt() }), steps);
  assert.equal(withHumanInterviewClearance(steps, {
    released: true, latestResult: attempt({ finalScore: null, clearanceStatus: "scheduled" }),
  }), steps);
  assert.equal(withHumanInterviewClearance(steps, undefined), steps);
});
