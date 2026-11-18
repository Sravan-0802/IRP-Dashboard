import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("./trackStatusData.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", write: false,
});
const { toTrackStatusResponse, MAX_REFRESH_AGE_MS } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);

const NOW = Date.parse("2026-01-10T06:00:00Z");
const row = (over = {}) => ({
  refresh_status: "success",
  refresh_finished_at: new Date(NOW - 60 * 60 * 1000),
  hustler_assessment_status: "QUALIFIED",
  fe_project_status: "NOT_QUALIFIED",
  human_interview_status: "QUALIFIED",
  calculated_at: "2026-01-10T04:51:36.000Z",
  ...over,
});
const opts = { humanInterviewReleased: true, now: NOW };

test("uses the new tables when the last refresh passed and is recent", () => {
  assert.deepEqual(toTrackStatusResponse(row(), opts), {
    source: "irp_v2",
    mern: {
      onlineAssessment: "QUALIFIED",
      feProject: "NOT_QUALIFIED",
      humanInterview: "QUALIFIED",
      calculatedAt: "2026-01-10T04:51:36.000Z",
    },
  });
});

test("hides the Human Interview result until the admin releases it", () => {
  const res = toTrackStatusResponse(row(), { ...opts, humanInterviewReleased: false });
  assert.equal(res.source, "irp_v2");
  assert.equal(res.mern.humanInterview, null);
  assert.equal(res.mern.onlineAssessment, "QUALIFIED");
});

test("falls back to the old logic when no refresh has been logged", () => {
  assert.deepEqual(toTrackStatusResponse(undefined, opts), { source: "legacy", mern: null, reason: "no_refresh_logged" });
});

test("falls back when the last refresh failed its old-vs-new checks", () => {
  assert.equal(toTrackStatusResponse(row({ refresh_status: "checks_failed" }), opts).reason, "refresh_checks_failed");
});

test("falls back when the refresh is older than the allowed age", () => {
  const stale = row({ refresh_finished_at: new Date(NOW - MAX_REFRESH_AGE_MS - 1000) });
  assert.equal(toTrackStatusResponse(stale, opts).reason, "refresh_stale");
  const fresh = row({ refresh_finished_at: new Date(NOW - MAX_REFRESH_AGE_MS + 1000).toISOString() });
  assert.equal(toTrackStatusResponse(fresh, opts).source, "irp_v2");
});

test("falls back when the student has no track row", () => {
  const missing = row({ hustler_assessment_status: null, fe_project_status: null, human_interview_status: null, calculated_at: null });
  assert.equal(toTrackStatusResponse(missing, opts).reason, "no_row_for_student");
});

test("falls back on a status value it does not know", () => {
  assert.equal(toTrackStatusResponse(row({ fe_project_status: "LOCKED" }), opts).reason, "no_row_for_student");
});
