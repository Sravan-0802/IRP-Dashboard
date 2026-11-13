import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Test the actual normalizer without opening a database connection.
const source = await readFile(new URL("./programBoard.ts", import.meta.url), "utf8");
let returnedRows = [];
let conflictOptions;
let pendingSave;
let persistedPayload;
let persistedUpdatedAt = new Date("2030-01-01T00:00:00.000Z");
const insertChain = {
  values() { return this; },
  onConflictDoUpdate(options) { conflictOptions = options; pendingSave = options; return this; },
  async returning() {
    const rows = returnedRows ?? [{ updatedAt: new Date("2030-01-02T00:00:00.000Z") }];
    if (rows.length && pendingSave) {
      persistedPayload = pendingSave.set.payload;
      persistedUpdatedAt = rows[0].updatedAt;
    }
    pendingSave = undefined;
    return rows;
  },
};
const context = {
  exports: {},
  require(name) {
    if (name === "@workspace/db") return {
      db: {
        insert: () => insertChain,
        select: () => ({ from: () => ({ where: () => ({ limit: async () => persistedPayload
          ? [{ payload: persistedPayload, updatedAt: persistedUpdatedAt }]
          : [] }) }) }),
      },
      pool: { query: async () => undefined }, programBoardTable: {},
    };
    if (name === "drizzle-orm") return {
      eq(column, value) { return { column, value }; },
      sql(strings, ...values) { return { text: strings.join("?"), values }; },
    };
    throw new Error(`Unexpected dependency: ${name}`);
  },
  URL,
  Date,
};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { parseProgramBoardBody, PROGRAM_BOARD_DEFAULTS, getProgramBoard, updateProgramBoard } = context.exports;
const event = (patch = {}) => ({
  id: "exam-1", date: "2030-01-12", program: "irp", label: "L1 Assessment",
  mode: "online", link: "https://example.com/assessment", ...patch,
});
const board = (events) => ({ ...PROGRAM_BOARD_DEFAULTS, calendar: { events, upcoming: [] } });

test("new boards contain no fabricated calendar dates", () => {
  assert.equal(PROGRAM_BOARD_DEFAULTS.calendar.events.length, 0);
  assert.equal(PROGRAM_BOARD_DEFAULTS.calendar.upcoming.length, 0);
});

test("keeps names, dates, modes and links for multiple assessments on one date", () => {
  const result = parseProgramBoardBody(board([event(), event({ id: "exam-2", label: "FE Main", mode: "offline", link: "https://example.com/venue" })]));
  assert.equal(result.ok, true);
  assert.equal(result.board.calendar.events[0].label, "L1 Assessment");
  assert.equal(result.board.calendar.events[1].mode, "offline");
  assert.equal(result.board.calendar.events[1].link, "https://example.com/venue");
  assert.equal(result.board.calendar.events[0].date, result.board.calendar.events[1].date);
});

test("does not truncate a monthly schedule at the former 40-row limit", () => {
  const events = Array.from({ length: 75 }, (_, i) => event({ id: `exam-${i}` }));
  const result = parseProgramBoardBody(board(events));
  assert.equal(result.ok, true);
  assert.equal(result.board.calendar.events.length, 75);
});

test("preserves legacy entries without inventing a mode or link", () => {
  const result = parseProgramBoardBody(board([{ id: "e1", date: "2030-01-05", program: "genai", label: "Legacy" }]));
  assert.equal(result.ok, true);
  assert.equal(result.board.calendar.events[0].mode, undefined);
  assert.equal(result.board.calendar.events[0].link, undefined);
});

for (const [description, patch] of [
  ["impossible date", { date: "2030-02-31" }],
  ["non-leap February", { date: "2030-02-29" }],
  ["unsafe link", { link: "javascript:alert(1)" }],
  ["credential-bearing link", { link: "https://user:password@example.com" }],
  ["missing assessment link", { link: "" }],
  ["unknown assessment mode", { mode: "hybrid" }],
  ["blank assessment name", { label: " " }],
]) {
  test(`rejects the entire save for ${description}`, () => {
    const result = parseProgramBoardBody(board([event({ id: "valid" }), event(patch)]));
    assert.equal(result.ok, false);
    assert.match(result.error, /Assessment row 2:/);
  });
}

test("rejects duplicate IDs and over-capacity schedules instead of silently deleting data", () => {
  assert.equal(parseProgramBoardBody(board([event(), event()])).ok, false);
  assert.equal(parseProgramBoardBody(board(Array.from({ length: 1001 }, (_, i) => event({ id: `exam-${i}` })))).ok, false);
});

test("stale-version saves return a conflict rather than a false success", async () => {
  returnedRows = [];
  await assert.rejects(updateProgramBoard(board([]), "2030-01-01T00:00:00.000Z"), /newer schedule/);
  assert.match(conflictOptions.setWhere.text, /date_trunc\('milliseconds'/);
  assert.ok(conflictOptions.setWhere.values.includes("2030-01-01T00:00:00.000Z"));
});

test("a new empty-board version cannot overwrite an already created document", async () => {
  returnedRows = [];
  await assert.rejects(updateProgramBoard(board([]), null), /newer schedule/);
  assert.equal(conflictOptions.setWhere.text, "false");
});

test("a successful guarded save returns the exact stored timestamp", async () => {
  returnedRows = [{ updatedAt: new Date("2030-01-02T00:00:00.000Z") }];
  const result = await updateProgramBoard(board([event()]), "2030-01-01T00:00:00.000Z");
  assert.equal(result.updatedAt, "2030-01-02T00:00:00.000Z");
  assert.equal(result.calendar.events[0].link, "https://example.com/assessment");
  assert.match(conflictOptions.set.updatedAt.text, /greatest\(clock_timestamp\(\)/);
  assert.match(conflictOptions.set.updatedAt.text, /\+ interval '1 millisecond'/);
});

test("removing an assessment persists its absence in the next student board read", async () => {
  const savedBoard = board([
    event({ id: "remove-me" }),
    event({ id: "keep-me", label: "Assessment that stays" }),
  ]);
  persistedPayload = JSON.stringify(savedBoard);
  persistedUpdatedAt = new Date("2030-01-01T00:00:00.000Z");
  returnedRows = null;

  const before = await getProgramBoard();
  assert.deepEqual(Array.from(before.calendar.events, (entry) => entry.id), ["remove-me", "keep-me"]);
  const nextBoard = {
    genai: before.genai,
    calendar: { ...before.calendar, events: before.calendar.events.filter((entry) => entry.id !== "remove-me") },
  };
  await updateProgramBoard(nextBoard, before.updatedAt);

  const after = await getProgramBoard();
  assert.deepEqual(Array.from(after.calendar.events, (entry) => entry.id), ["keep-me"]);
  assert.equal(Array.from(after.calendar.events).some((entry) => entry.id === "remove-me"), false);
});
