import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("./useProgramBoard.ts", import.meta.url), "utf8");
const fetchFn = source.match(/async function fetchProgramBoard\(\)[\s\S]*?\n\}/)?.[0];

async function runFetch({ token, status = 200, body = { genai: {}, calendar: { events: [], upcoming: [] } } }) {
  assert.ok(fetchFn, "fetchProgramBoard exists");
  const calls = [];
  const context = {
    getAuthToken: () => token,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    },
    result: null,
    error: null,
  };
  const code = ts.transpileModule(
    `${fetchFn}\nfetchProgramBoard().then((v) => { result = v; }, (e) => { error = e; });`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  vm.runInNewContext(code, context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { calls, result: context.result, error: context.error };
}

test("program board request sends the SSO token as a Bearer header", async () => {
  const { calls, result } = await runFetch({ token: "sso-token" });
  assert.equal(calls[0].url, "/api/student/program-board");
  assert.equal(calls[0].init.headers.authorization, "Bearer sso-token");
  assert.ok(result?.calendar);
});

test("program board request works without a token (local dev fallback)", async () => {
  const { calls } = await runFetch({ token: null });
  assert.equal(calls[0].init.headers.authorization, undefined);
});

test("a rejected request surfaces as an error instead of silently keeping stale data", async () => {
  const { error } = await runFetch({ token: "expired", status: 401 });
  assert.match(String(error?.message), /401/);
});
