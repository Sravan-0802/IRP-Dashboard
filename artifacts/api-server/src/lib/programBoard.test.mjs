import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Test the actual normalizer without opening a database connection.
const source = await readFile(new URL("./programBoard.ts", import.meta.url), "utf8");
let storedPayload = null;
let storedUpdatedAt = null;
let revisions = [];
let nextRevisionId = 1;
let savedAtSql = "";
const client = {
  async query(text, values = []) {
    if (text === "ROLLBACK" || text === "COMMIT" || text === "BEGIN" || text.includes("pg_advisory_xact_lock")) {
      return { rows: [] };
    }
    if (text.includes("SELECT payload, updated_at")) {
      return { rows: storedPayload == null ? [] : [{ payload: storedPayload, updatedAt: storedUpdatedAt }] };
    }
    if (text.includes("SELECT EXISTS")) {
      return { rows: [{ exists: revisions.some((revision) => revision.month === values[0]) }] };
    }
    if (text.includes("SELECT events FROM program_board_calendar_revisions")) {
      const revision = revisions.find((item) => item.id === values[0] && item.month === values[1]);
      return { rows: revision ? [{ events: revision.events }] : [] };
    }
    if (text.includes("clock_timestamp()") && text.includes("interval '1 millisecond'")) {
      savedAtSql = text;
      const previousTime = values[0] == null ? 0 : new Date(values[0]).getTime() + 1;
      return { rows: [{ savedAt: new Date(Math.max(Date.now(), previousTime)) }] };
    }
    if (text.includes("INSERT INTO program_board_calendar_revisions")) {
      const [month, rawEvents, author, createdAt, boardUpdatedAt] = values;
      revisions.push({
        id: String(nextRevisionId++),
        month,
        events: JSON.parse(rawEvents),
        author,
        createdAt: new Date(createdAt),
        boardUpdatedAt,
      });
      return { rows: [] };
    }
    if (text.includes("INSERT INTO program_board (")) {
      storedPayload = values[1];
      storedUpdatedAt = new Date(values[2]);
      return { rows: [{ updatedAt: storedUpdatedAt }] };
    }
    throw new Error(`Unexpected SQL in test: ${text}`);
  },
  release() {},
};
const context = {
  exports: {},
  require(name) {
    if (name === "@workspace/db") return {
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => storedPayload
                ? [{ payload: storedPayload, updatedAt: storedUpdatedAt }]
                : [],
            }),
          }),
        }),
        insert() { throw new Error("Database access is forbidden in these tests"); },
      },
      pool: {
        query: async (_sql, values = []) => ({
          rows: revisions
            .filter((revision) => revision.month === values[0])
            .map(({ id, month, events, author, createdAt }) => ({ id, month, events, author, createdAt })),
        }),
        connect: async () => client,
      },
      programBoardTable: {},
    };
    if (name === "drizzle-orm") return {
      eq(column, value) { return { column, value }; },
    };
    throw new Error(`Unexpected dependency: ${name}`);
  },
  URL,
  Date,
};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const boardModule = context.exports;
const { parseProgramBoardBody, PROGRAM_BOARD_DEFAULTS, getProgramBoard } = boardModule;
const resetStore = (payload = null, updatedAt = null) => {
  storedPayload = payload == null ? null : JSON.stringify(payload);
  storedUpdatedAt = updatedAt == null ? null : new Date(updatedAt);
  revisions = [];
  nextRevisionId = 1;
  savedAtSql = "";
};
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
  resetStore(board([event()]), "2030-01-02T00:00:00.000Z");
  await assert.rejects(boardModule.updateProgramBoard(board([]), "2030-01-01T00:00:00.000Z"), /newer schedule/);
  assert.equal(revisions.length, 0);
});

test("a new empty-board version cannot overwrite an already created document", async () => {
  resetStore(board([event()]), "2030-01-02T00:00:00.000Z");
  await assert.rejects(boardModule.updateProgramBoard(board([]), null), /newer schedule/);
  assert.equal(revisions.length, 0);
});

test("a successful guarded save returns the exact stored timestamp", async () => {
  resetStore(board([]), "2030-01-01T00:00:00.000Z");
  const result = await boardModule.updateProgramBoard(board([event()]), "2030-01-01T00:00:00.000Z", "Calendar Admin");
  assert.equal(result.updatedAt, storedUpdatedAt.toISOString());
  assert.equal(result.calendar.events[0].link, "https://example.com/assessment");
  assert.match(savedAtSql, /greatest\(\s*clock_timestamp\(\)/);
  assert.match(savedAtSql, /\+ interval '1 millisecond'/);
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0].author, "Before history tracking");
  assert.equal(revisions[1].author, "Calendar Admin");
  assert.deepEqual(revisions[1].events, [event()]);
});

test("restoring one month preserves other months and GenAI program content", async () => {
  const current = board([
    event({ label: "Current January" }),
    event({ id: "feb-event", date: "2030-02-10", label: "Keep February" }),
  ]);
  current.genai = { ...current.genai, aboutTitle: "Keep GenAI content" };
  resetStore(current, "2030-01-03T00:00:00.000Z");
  const previousJanuary = [event({ label: "Earlier January" })];
  revisions.push({
    id: "7",
    month: "2030-01",
    events: previousJanuary,
    author: "Earlier admin",
    createdAt: new Date("2030-01-01T00:00:00.000Z"),
    boardUpdatedAt: new Date("2030-01-01T00:00:00.000Z"),
  });

  const restored = await boardModule.restoreCalendarRevision(
    "7", "2030-01", "2030-01-03T00:00:00.000Z", "Restore Admin",
  );
  const stored = JSON.parse(storedPayload);
  assert.deepEqual(
    stored.calendar.events.sort((a, b) => a.date.localeCompare(b.date)),
    [...previousJanuary, current.calendar.events[1]].sort((a, b) => a.date.localeCompare(b.date)),
  );
  assert.equal(stored.genai.aboutTitle, "Keep GenAI content");
  assert.equal(restored.calendar.events.find((item) => item.id === "feb-event").label, "Keep February");
  assert.equal(revisions.at(-1).author, "Restore Admin");
  assert.deepEqual(revisions.at(-1).events, previousJanuary);
});

test("blocks a restore if it would duplicate an assessment ID in another month", async () => {
  const current = board([
    event({ id: "moved-assessment", date: "2030-02-10" }),
  ]);
  resetStore(current, "2030-02-03T00:00:00.000Z");
  revisions.push({
    id: "8",
    month: "2030-01",
    events: [event({ id: "moved-assessment", date: "2030-01-12" })],
    author: "Earlier admin",
    createdAt: new Date("2030-01-01T00:00:00.000Z"),
    boardUpdatedAt: new Date("2030-01-01T00:00:00.000Z"),
  });
  const originalPayload = storedPayload;
  await assert.rejects(
    boardModule.restoreCalendarRevision("8", "2030-01", "2030-02-03T00:00:00.000Z"),
    /assessment ID now used in another month/,
  );
  assert.equal(storedPayload, originalPayload);
});

test("lists month revisions with author, timestamp, and their saved assessments", async () => {
  resetStore();
  const createdAt = new Date("2030-01-04T12:30:00.000Z");
  revisions.push({
    id: "9",
    month: "2030-01",
    events: [event()],
    author: "Calendar Admin",
    createdAt,
    boardUpdatedAt: createdAt,
  });
  const listed = await boardModule.listCalendarRevisions("2030-01");
  assert.deepEqual(JSON.parse(JSON.stringify(listed)), [{
    id: "9",
    month: "2030-01",
    events: [event()],
    author: "Calendar Admin",
    createdAt: createdAt.toISOString(),
  }]);
});

test("removing an assessment persists its absence in the next student board read", async () => {
  const savedBoard = board([
    event({ id: "remove-me" }),
    event({ id: "keep-me", label: "Assessment that stays" }),
  ]);
  resetStore(savedBoard, "2030-01-01T00:00:00.000Z");

  const before = await getProgramBoard();
  assert.deepEqual(Array.from(before.calendar.events, (entry) => entry.id), ["remove-me", "keep-me"]);
  const nextBoard = {
    genai: before.genai,
    calendar: { ...before.calendar, events: before.calendar.events.filter((entry) => entry.id !== "remove-me") },
  };
  await boardModule.updateProgramBoard(nextBoard, before.updatedAt);

  const after = await getProgramBoard();
  assert.deepEqual(Array.from(after.calendar.events, (entry) => entry.id), ["keep-me"]);
  assert.equal(Array.from(after.calendar.events).some((entry) => entry.id === "remove-me"), false);
});
