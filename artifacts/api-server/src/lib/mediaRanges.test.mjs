import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("./mediaRanges.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source.replaceAll("export ", ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = vm.createContext({ Buffer, fetch, AbortSignal });
vm.runInContext(`${js}\nthis.api = { boundedMediaRange, fetchLoomRange, MEDIA_CHUNK_BYTES };`, context);
const { boundedMediaRange, fetchLoomRange, MEDIA_CHUNK_BYTES: size } = context.api;

test("caps no-range, open-ended, huge, seek and suffix requests", () => {
  assert.equal(boundedMediaRange(), `bytes=0-${size - 1}`);
  assert.equal(boundedMediaRange("bytes=0-"), `bytes=0-${size - 1}`);
  assert.equal(boundedMediaRange("bytes=0-80283572"), `bytes=0-${size - 1}`);
  assert.equal(boundedMediaRange("bytes=70000000-"), `bytes=70000000-${70000000 + size - 1}`);
  assert.equal(boundedMediaRange("bytes=0-1"), "bytes=0-1");
  assert.equal(boundedMediaRange("bytes=-500"), "bytes=-500");
  assert.equal(boundedMediaRange("bytes=-9000000"), `bytes=-${size}`);
});

test("rejects malformed, multiple, reversed and unsafe ranges", () => {
  for (const range of ["bytes=-", "items=0-1", "bytes=2-1", "bytes=0-1,4-5", "bytes=-0", "bytes=9007199254740992-"]) {
    assert.equal(boundedMediaRange(range), null);
  }
});

test("returns a verified bounded chunk and forwards its byte range", async () => {
  const result = await fetchLoomRange("bytes=0-3", AbortSignal.timeout(1000), async (_url, init) => {
    assert.equal(init.headers.Range, "bytes=0-3");
    return new Response(new Uint8Array([0, 1, 2, 3]), {
      status: 206, headers: { "content-range": "bytes 0-3/100", "content-type": "video/mp4" },
    });
  });
  assert.equal(result.status, 206);
  assert.equal(result.total, 100);
  assert.equal(result.body.length, 4);
});

test("refuses full-file, HTML and truncated responses instead of forwarding them", async () => {
  for (const response of [
    new Response("full file", { status: 200 }),
    new Response("html", { status: 206, headers: { "content-range": "bytes 0-3/100", "content-type": "text/html" } }),
    new Response("x", { status: 206, headers: { "content-range": "bytes 0-3/100", "content-type": "video/mp4" } }),
  ]) {
    await assert.rejects(fetchLoomRange("bytes=0-3", AbortSignal.timeout(1000), async () => response));
  }
});

test("retains upstream unsatisfiable-range metadata", async () => {
  const result = await fetchLoomRange("bytes=200-", AbortSignal.timeout(1000), async () =>
    new Response(null, { status: 416, headers: { "content-range": "bytes */100" } }));
  assert.equal(result.status, 416);
  assert.equal(result.contentRange, "bytes */100");
});
