import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import express from "express";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("./genaiProjectSubmission.ts", import.meta.url))],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  external: ["express"],
  plugins: [
    {
      name: "api-zod-test-schema",
      setup(build) {
        build.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({
          path: "api-zod-test-schema",
          namespace: "test-fixture",
        }));
        build.onLoad({ filter: /.*/, namespace: "test-fixture" }, () => ({
          loader: "js",
          contents: `
            const response = { parse: value => value };
            export const GetGenaiProjectSubmissionResponse = response;
            export const SaveGenaiProjectSubmissionResponse = response;
            export const SaveGenaiProjectSubmissionBody = {
              safeParse(value) {
                if (value && typeof value.projectTitle === "string" && value.projectTitle.length > 0
                  && typeof value.loomUrl === "string" && value.loomUrl.length > 0) {
                  return { success: true, data: value };
                }
                return { success: false };
              }
            };
          `,
        }));
      },
    },
  ],
});
const routeModule = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(
  createRequire(import.meta.url),
  routeModule,
  routeModule.exports,
);
const { createGenaiProjectSubmissionRouter } = routeModule.exports;

const records = new Map();
let saveCalls = [];
let failSave = false;
let clock = 0;

const repository = {
  async findForUser(userId) {
    return records.get(userId) ?? null;
  },
  async saveForUser(userId, projectTitle, loomUrl) {
    saveCalls.push({ userId, projectTitle, loomUrl });
    if (failSave) throw new Error("database unavailable");
    const record = {
      projectTitle,
      loomUrl,
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)),
    };
    records.set(userId, record);
    return record;
  },
};

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { error() {} };
  next();
});
app.use(
  createGenaiProjectSubmissionRouter({
    resolveAcademyUserId: async (req) => req.get("x-test-student") ?? null,
    repository,
  }),
);
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/student/genai-project-submission`;
after(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  records.clear();
  saveCalls = [];
  failSave = false;
  clock = 0;
});

const student = (id) => ({ "x-test-student": id });
const body = (loomUrl, projectTitle = "Intelligent RAG Challenge", extra = {}) => ({
  projectTitle,
  loomUrl,
  ...extra,
});

test("accepts Loom share and embed links and persists them for the authenticated student", async () => {
  const examples = [
    body("https://www.loom.com/share/video_123"),
    body("https://loom.com/embed/video-456/"),
  ];

  for (const input of examples) {
    const response = await fetch(base, {
      method: "PUT",
      headers: { ...student("student-a"), "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 200);
    const responseBody = await response.json();
    assert.equal(responseBody.submission.loomUrl, input.loomUrl);
    assert.equal(responseBody.submission.projectTitle, input.projectTitle);
  }
  assert.equal(saveCalls.length, 2);
  assert.ok(saveCalls.every((call) => call.userId === "student-a"));
  assert.equal(records.get("student-a").loomUrl, examples[1].loomUrl);
});

test("rejects unrelated hosts, insecure protocols, and invalid Loom paths without saving", async () => {
  const invalidUrls = [
    "https://notloom.com/share/video",
    "https://loom.com.evil.example/share/video",
    "https://www.loom.com.evil.example/share/video",
    "http://www.loom.com/share/video",
    "https://www.loom.com/record/video",
    "https://www.loom.com/share/video/extra",
    "https://www.loom.com/share/",
    "https://www.loom.com/share/video.more",
  ];

  for (const loomUrl of invalidUrls) {
    const response = await fetch(base, {
      method: "PUT",
      headers: { ...student("student-a"), "content-type": "application/json" },
      body: JSON.stringify(body(loomUrl)),
    });
    assert.equal(response.status, 400, loomUrl);
  }
  assert.equal(saveCalls.length, 0);
  assert.equal(records.size, 0);
});

test("requires authentication before reading or writing submissions", async () => {
  assert.equal((await fetch(base)).status, 401);
  assert.equal(
    (
      await fetch(base, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body("https://www.loom.com/share/video")),
      })
    ).status,
    401,
  );
  assert.equal(saveCalls.length, 0);
});

test("isolates records by authenticated student and ignores submitted identity fields", async () => {
  records.set("student-a", {
    projectTitle: "Intelligent RAG Challenge",
    loomUrl: "https://www.loom.com/share/a-video",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  records.set("student-b", {
    projectTitle: "Agentic RAG Challenge",
    loomUrl: "https://www.loom.com/share/b-video",
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  });

  const readA = await fetch(`${base}?userId=student-b`, { headers: student("student-a") });
  assert.equal((await readA.json()).submission.loomUrl, "https://www.loom.com/share/a-video");
  const readB = await fetch(base, { headers: student("student-b") });
  assert.equal((await readB.json()).submission.loomUrl, "https://www.loom.com/share/b-video");

  const updateA = await fetch(base, {
    method: "PUT",
    headers: { ...student("student-a"), "content-type": "application/json" },
    body: JSON.stringify(
      body("https://www.loom.com/share/a-new-video", "Agentic RAG Challenge", { userId: "student-b" }),
    ),
  });
  assert.equal(updateA.status, 200);
  assert.equal(saveCalls[0].userId, "student-a");
  assert.equal(records.get("student-a").loomUrl, "https://www.loom.com/share/a-new-video");
  assert.equal(records.get("student-b").loomUrl, "https://www.loom.com/share/b-video");
});

test("updates the existing record and returns the new persisted values", async () => {
  const submit = async (loomUrl, projectTitle) =>
    fetch(base, {
      method: "PUT",
      headers: { ...student("student-a"), "content-type": "application/json" },
      body: JSON.stringify(body(loomUrl, projectTitle)),
    });

  const first = await submit("https://www.loom.com/share/first", "Intelligent RAG Challenge");
  const firstSubmission = (await first.json()).submission;
  const updated = await submit("https://www.loom.com/share/second", "Building & Optimizing RAG Challenge");
  const updatedSubmission = (await updated.json()).submission;

  assert.equal(records.size, 1);
  assert.equal(updatedSubmission.projectTitle, "Building & Optimizing RAG Challenge");
  assert.equal(updatedSubmission.loomUrl, "https://www.loom.com/share/second");
  assert.notEqual(updatedSubmission.updatedAt, firstSubmission.updatedAt);
});

test("reports database failures without returning a success response", async () => {
  failSave = true;
  const response = await fetch(base, {
    method: "PUT",
    headers: { ...student("student-a"), "content-type": "application/json" },
    body: JSON.stringify(body("https://www.loom.com/share/video")),
  });
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /Could not save your Loom link/);
});
