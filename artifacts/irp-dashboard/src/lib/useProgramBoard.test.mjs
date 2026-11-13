import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("./useProgramBoard.ts", import.meta.url), "utf8");
function runHook(token, response = { genai: {}, calendar: { events: [], upcoming: [] } }) {
  let options;
  const context = {
    exports: {},
    require(name) {
      if (name === "@workspace/api-client-react") return {
        getGetStudentProgramBoardQueryKey: () => ["/api/student/program-board"],
        useGetStudentProgramBoard(input) {
          options = input;
          return { data: input.query.select(response), isError: false };
        },
      };
      if (name === "@/lib/authToken") return { getAuthToken: () => token };
      if (name === "@/lib/programBoard") return { DEFAULT_PROGRAM_BOARD: {} };
      throw new Error(name);
    },
  };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  const result = context.exports.useProgramBoardQuery();
  return { result, options };
}

test("generated program board request receives the SSO bearer token", () => {
  const { options, result } = runHook("sso-token");
  assert.equal(options.request.headers.authorization, "Bearer sso-token");
  assert.equal(options.request.cache, "no-store");
  assert.ok(result.data.calendar);
});

test("local dev requests omit the bearer header when no token is present", () => {
  assert.equal(runHook(null).options.request.headers.authorization, undefined);
});

test("the student calendar refreshes on mount, focus and every 30 seconds", () => {
  const { options } = runHook(null);
  assert.equal(options.query.queryKey[0], "/api/student/program-board");
  assert.equal(options.query.staleTime, 0);
  assert.equal(options.query.refetchInterval, 30_000);
  assert.equal(options.query.refetchOnMount, "always");
  assert.equal(options.query.refetchOnWindowFocus, true);
});

test("incomplete responses fail explicitly instead of becoming a sample calendar", () => {
  assert.throws(() => runHook(null, { genai: {} }), /response is incomplete/);
});
