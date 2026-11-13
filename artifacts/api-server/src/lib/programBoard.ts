import { db, pool, programBoardTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ProgramBoardDocument } from "@workspace/api-zod";

const ROW_ID = 1;
const MAX_ITEMS = 40;
const MAX_CALENDAR_ITEMS = 1000;
const MAX_TEXT = 500;
const MAX_BODY = 2000;

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS program_board (
  id integer PRIMARY KEY DEFAULT 1,
  payload text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS program_board_calendar_revisions (
  id bigserial PRIMARY KEY,
  month text NOT NULL CHECK (month ~ '^\\d{4}-(0[1-9]|1[0-2])$'),
  events jsonb NOT NULL,
  author text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  board_updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS program_board_calendar_revisions_month_created_idx
  ON program_board_calendar_revisions (month, created_at DESC, id DESC);
`;

let ensureTablePromise: Promise<void> | null = null;

async function ensureProgramBoardTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = pool
      .query(ENSURE_SQL)
      .then(() => undefined)
      .catch((err) => {
        ensureTablePromise = null;
        throw err;
      });
  }
  await ensureTablePromise;
}

const LIVE_URL = "https://meetings.ccbp.in/mid/irp-genai-training";
const PRACTICE_URL = "https://nxtinterview.ccbp.in/interview/67b87057-99ab-4db4-811c-48fa2620b515";

export type ProgramBoardContent = Omit<ProgramBoardDocument, "updatedAt">;

export const PROGRAM_BOARD_DEFAULTS: ProgramBoardContent = {
  genai: {
    subtitle: "Live classes and your GenAI path.",
    liveBadge: "",
    weekLabel: "",
    classTitle: "",
    weekOf: "",
    classHour: 19,
    classMinute: 0,
    stats: [],
    assessments: [],
    classes: [],
    recordingsEmpty: "Recordings appear here after each live class.",
    portalLabel: "Open GenAI on Learning Portal",
    practiceEyebrow: "PRACTICE",
    practiceTitle: "NxtMock GenAI practice",
    practiceBody: "Timed mocks in the same format as your assessments. Attempt at least one before Assessment 2.",
    practiceCta: "Practice on NxtMock",
    aboutTitle: "About this program",
    aboutBody: "One-line program description from the program team.",
    syllabusLabel: "View syllabus",
    communityLabel: "Join GenAI community group",
    supportLabel: "Support: contact the program team",
    liveUrl: LIVE_URL,
    portalUrl: "https://learning.ccbp.in/course-live-classes",
    practiceUrl: PRACTICE_URL,
    syllabusUrl: LIVE_URL,
    communityUrl: LIVE_URL,
  },
  calendar: {
    events: [],
    upcoming: [],
  },
};

export type ProgramBoardResponse = ProgramBoardContent & { updatedAt: string | null };
export type CalendarRevision = {
  id: string;
  month: string;
  events: ProgramBoardContent["calendar"]["events"];
  author: string;
  createdAt: string;
};

function text(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Dashboard path (`/`, `/assessments-hub`) or an http(s) URL. Anything else opens the dashboard. */
function classLink(value: unknown): string {
  const raw = text(value, 1000);
  if (!raw) return "/";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return raw;
  } catch {
    return "/";
  }
  return "/";
}

function httpUrl(value: unknown, fallback: string): string {
  const raw = text(value, 1000);
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return raw;
  } catch {
    return fallback;
  }
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, MAX_ITEMS) : [];
}

function idOf(value: unknown, prefix: string, index: number): string {
  const raw = text(value, 80).replace(/[^\w.-]/g, "");
  return raw || `${prefix}-${index + 1}`;
}

function parseGenAi(raw: unknown): ProgramBoardContent["genai"] | null {
  const row = asRecord(raw);
  if (!row) return null;
  const base = PROGRAM_BOARD_DEFAULTS.genai;
  const hour = Number(row.classHour);
  const minute = Number(row.classMinute);
  return {
    subtitle: text(row.subtitle) || base.subtitle,
    liveBadge: text(row.liveBadge),
    weekLabel: text(row.weekLabel),
    classTitle: text(row.classTitle),
    weekOf: text(row.weekOf),
    classHour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : base.classHour,
    classMinute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : base.classMinute,
    stats: asList(row.stats).map((item) => {
      const stat = asRecord(item);
      return {
        label: text(stat?.label, 80),
        value: text(stat?.value, 120),
        hint: text(stat?.hint, 160),
        hintTone: oneOf(stat?.hintTone, ["default", "warn"] as const, "default"),
      };
    }).filter((stat) => stat.label || stat.value),
    assessments: asList(row.assessments).map((item, index) => {
      const assessment = asRecord(item);
      return {
        id: idOf(assessment?.id, "assessment", index),
        label: text(assessment?.label, 80),
        title: text(assessment?.title, 160),
        when: text(assessment?.when, 160),
        score: text(assessment?.score, 40),
        note: text(assessment?.note, 240),
        noteTone: oneOf(assessment?.noteTone, ["default", "warn"] as const, "default"),
        status: oneOf(assessment?.status, ["completed", "open", "upcoming"] as const, "upcoming"),
        actionLabel: text(assessment?.actionLabel, 80),
      };
    }).filter((item) => item.title),
    classes: asList(row.classes).map((item) => {
      const session = asRecord(item);
      return {
        day: text(session?.day, 20),
        date: text(session?.date, 20),
        title: text(session?.title, 160),
        time: text(session?.time, 80),
        duration: text(session?.duration, 40),
        instructor: text(session?.instructor, 80),
        action: text(session?.action, 80),
        live: session?.live === true,
        link: classLink(session?.link),
      };
    }).filter((item) => item.title),
    recordingsEmpty: text(row.recordingsEmpty) || base.recordingsEmpty,
    portalLabel: text(row.portalLabel) || base.portalLabel,
    practiceEyebrow: text(row.practiceEyebrow, 40) || base.practiceEyebrow,
    practiceTitle: text(row.practiceTitle) || base.practiceTitle,
    practiceBody: text(row.practiceBody, MAX_BODY) || base.practiceBody,
    practiceCta: text(row.practiceCta) || base.practiceCta,
    aboutTitle: text(row.aboutTitle) || base.aboutTitle,
    aboutBody: text(row.aboutBody, MAX_BODY) || base.aboutBody,
    syllabusLabel: text(row.syllabusLabel) || base.syllabusLabel,
    communityLabel: text(row.communityLabel) || base.communityLabel,
    supportLabel: text(row.supportLabel) || base.supportLabel,
    liveUrl: httpUrl(row.liveUrl, base.liveUrl),
    portalUrl: httpUrl(row.portalUrl, base.portalUrl),
    practiceUrl: httpUrl(row.practiceUrl, base.practiceUrl),
    syllabusUrl: httpUrl(row.syllabusUrl, base.syllabusUrl),
    communityUrl: httpUrl(row.communityUrl, base.communityUrl),
  };
}

function parseCalendar(raw: unknown): ProgramBoardContent["calendar"] | null {
  const row = asRecord(raw);
  if (!row) return null;
  return {
    events: (Array.isArray(row.events) ? row.events.slice(0, MAX_CALENDAR_ITEMS) : []).map((item, index): ProgramBoardContent["calendar"]["events"][number] => {
      const event = asRecord(item);
      const date = text(event?.date, 10);
      return {
        id: idOf(event?.id, "event", index),
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
        program: oneOf(event?.program, ["irp", "genai"] as const, "irp"),
        label: text(event?.label, 200),
        ...(event?.mode === "online" || event?.mode === "offline" ? { mode: event.mode } : {}),
        ...(typeof event?.link === "string" ? { link: text(event.link, 2000) } : {}),
      };
    }).filter((event) => event.date && event.label),
    upcoming: asList(row.upcoming).map((item, index) => {
      const entry = asRecord(item);
      return {
        id: idOf(entry?.id, "upcoming", index),
        program: oneOf(entry?.program, ["irp", "genai"] as const, "irp"),
        when: text(entry?.when, 80),
        title: text(entry?.title, 200),
        detail: text(entry?.detail, 200),
        action: oneOf(entry?.action, ["", "register", "submit"] as const, ""),
        badge: oneOf(entry?.badge, ["", "not-registered", "upcoming", "locked"] as const, ""),
      };
    }).filter((item) => item.title),
  };
}

export function parseProgramBoardBody(body: unknown): { ok: true; board: ProgramBoardContent } | { ok: false; error: string } {
  const row = asRecord(body);
  if (!row) return { ok: false, error: "Expected a JSON object" };
  const calendarInput = asRecord(row.calendar);
  if (!calendarInput || !Array.isArray(calendarInput.events)) {
    return { ok: false, error: "calendar.events must be an array" };
  }
  if (calendarInput.events.length > MAX_CALENDAR_ITEMS) {
    return { ok: false, error: `At most ${MAX_CALENDAR_ITEMS} calendar assessments can be saved` };
  }
  const ids = new Set<string>();
  for (const [index, value] of calendarInput.events.entries()) {
    const event = asRecord(value);
    const prefix = `Assessment row ${index + 1}: `;
    if (!event || typeof event.id !== "string" || !/^[\w.-]{1,80}$/.test(event.id)) {
      return { ok: false, error: prefix + "a valid assessment ID is required" };
    }
    if (ids.has(event.id)) return { ok: false, error: prefix + "duplicate assessment ID" };
    ids.add(event.id);
    if (typeof event.label !== "string" || !event.label.trim() || event.label.trim().length > 200) {
      return { ok: false, error: prefix + "assessment name must contain 1–200 characters" };
    }
    const date = typeof event.date === "string" ? event.date : "";
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      return { ok: false, error: prefix + "use a real assessment date in YYYY-MM-DD format" };
    }
    if (event.program !== "irp" && event.program !== "genai") {
      return { ok: false, error: prefix + "program must be MERN/IRP or GenAI" };
    }
    if (event.mode !== undefined && event.mode !== "online" && event.mode !== "offline") {
      return { ok: false, error: prefix + "assessment mode must be Online or Offline" };
    }
    const link = typeof event.link === "string" ? event.link.trim() : "";
    if (event.link !== undefined && typeof event.link !== "string") {
      return { ok: false, error: prefix + "assessment link must be text" };
    }
    if (link) {
      try {
        const url = new URL(link);
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || link.length > 2000) throw new Error("invalid");
      } catch {
        return { ok: false, error: prefix + "assessment link must be a valid http(s) URL without credentials" };
      }
    }
  }
  const genai = parseGenAi(row.genai);
  const calendar = parseCalendar(row.calendar);
  if (!genai || !calendar) return { ok: false, error: "genai and calendar are required" };
  return { ok: true, board: { genai, calendar } };
}

function toResponse(board: ProgramBoardContent, updatedAt: Date | null): ProgramBoardResponse {
  return { ...board, updatedAt: updatedAt ? updatedAt.toISOString() : null };
}

export async function getProgramBoard(): Promise<ProgramBoardResponse> {
  await ensureProgramBoardTable();
  const [row] = await db.select().from(programBoardTable).where(eq(programBoardTable.id, ROW_ID)).limit(1);
  if (!row) return toResponse(PROGRAM_BOARD_DEFAULTS, null);
  const parsed = parseProgramBoardBody(JSON.parse(row.payload));
  if (!parsed.ok) throw new Error(`Stored program board is invalid: ${parsed.error}`);
  return toResponse(parsed.board, row.updatedAt);
}

export class ProgramBoardConflictError extends Error {
  constructor() {
    super("Another admin saved a newer schedule. Your draft has been kept. Refresh before saving again.");
    this.name = "ProgramBoardConflictError";
  }
}

export class ProgramBoardRevisionNotFoundError extends Error {
  constructor() {
    super("Calendar revision not found.");
    this.name = "ProgramBoardRevisionNotFoundError";
  }
}

export class ProgramBoardRevisionConflictError extends Error {
  constructor() {
    super("This revision contains an assessment ID now used in another month. Resolve that entry before restoring.");
    this.name = "ProgramBoardRevisionConflictError";
  }
}

type StoredProgramBoard = { board: ProgramBoardContent; updatedAt: Date | null };
type ProgramBoardClient = {
  query: <T = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<{ rows: T[] }>;
  release: () => void;
};

function storedBoard(payload: unknown, updatedAt: Date | null): StoredProgramBoard {
  if (payload == null) return { board: PROGRAM_BOARD_DEFAULTS, updatedAt: null };
  const raw = typeof payload === "string" ? JSON.parse(payload) : payload;
  const parsed = parseProgramBoardBody(raw);
  if (!parsed.ok) throw new Error(`Stored program board is invalid: ${parsed.error}`);
  return { board: parsed.board, updatedAt };
}

function eventsForMonth(board: ProgramBoardContent, month: string) {
  return board.calendar.events.filter((event) => event.date.startsWith(`${month}-`));
}

function changedMonths(before: ProgramBoardContent, after: ProgramBoardContent): string[] {
  const months = new Set<string>();
  for (const event of [...before.calendar.events, ...after.calendar.events]) {
    if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(event.date)) months.add(event.date.slice(0, 7));
  }
  return [...months].filter((month) =>
    JSON.stringify(eventsForMonth(before, month)) !== JSON.stringify(eventsForMonth(after, month)),
  );
}

function authorLabel(author: unknown): string {
  return typeof author === "string" && author.trim() ? author.trim().slice(0, 80) : "Admin";
}

async function readBoardForUpdate(client: ProgramBoardClient): Promise<StoredProgramBoard> {
  const { rows } = await client.query<{ payload: string; updatedAt: Date }>(
    'SELECT payload, updated_at AS "updatedAt" FROM program_board WHERE id = $1 FOR UPDATE',
    [ROW_ID],
  );
  const row = rows[0];
  return row ? storedBoard(row.payload, row.updatedAt) : storedBoard(null, null);
}

function assertExpectedVersion(current: StoredProgramBoard, expectedUpdatedAt?: string | null): void {
  if (expectedUpdatedAt === undefined) return;
  const expected = expectedUpdatedAt === null ? null : Date.parse(expectedUpdatedAt);
  const actual = current.updatedAt?.getTime() ?? null;
  if (expected !== actual) throw new ProgramBoardConflictError();
}

async function ensureMonthBaseline(
  client: ProgramBoardClient,
  month: string,
  before: StoredProgramBoard,
  fallbackCreatedAt: Date,
): Promise<void> {
  const { rows } = await client.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM program_board_calendar_revisions WHERE month = $1) AS exists",
    [month],
  );
  if (rows[0]?.exists) return;
  await client.query(
    `INSERT INTO program_board_calendar_revisions
      (month, events, author, created_at, board_updated_at)
     VALUES ($1, $2::jsonb, $3, $4, $5)`,
    [
      month,
      JSON.stringify(eventsForMonth(before.board, month)),
      "Before history tracking",
      before.updatedAt ?? fallbackCreatedAt,
      before.updatedAt,
    ],
  );
}

async function saveBoardInTransaction(
  client: ProgramBoardClient,
  before: StoredProgramBoard,
  board: ProgramBoardContent,
  author: unknown,
): Promise<ProgramBoardResponse> {
  const changed = changedMonths(before.board, board);
  const { rows: clockRows } = await client.query<{ savedAt: Date }>(
    `SELECT greatest(
       clock_timestamp(),
       COALESCE($1::timestamptz + interval '1 millisecond', '-infinity'::timestamptz)
     ) AS "savedAt"`,
    [before.updatedAt],
  );
  const savedAt = clockRows[0]?.savedAt ?? new Date();
  for (const month of changed) {
    await ensureMonthBaseline(client, month, before, savedAt);
  }
  const payload = JSON.stringify(board);
  const { rows } = await client.query<{ updatedAt: Date }>(
    `INSERT INTO program_board (id, payload, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
     RETURNING updated_at AS "updatedAt"`,
    [ROW_ID, payload, savedAt],
  );
  const updatedAt = rows[0]?.updatedAt ?? savedAt;
  for (const month of changed) {
    await client.query(
      `INSERT INTO program_board_calendar_revisions
        (month, events, author, created_at, board_updated_at)
       VALUES ($1, $2::jsonb, $3, $4, $4)`,
      [month, JSON.stringify(eventsForMonth(board, month)), authorLabel(author), updatedAt],
    );
  }
  return toResponse(board, updatedAt);
}

export async function updateProgramBoard(
  board: ProgramBoardContent,
  expectedUpdatedAt?: string | null,
  author?: unknown,
): Promise<ProgramBoardResponse> {
  await ensureProgramBoardTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [71942, ROW_ID]);
    const before = await readBoardForUpdate(client);
    assertExpectedVersion(before, expectedUpdatedAt);
    const result = await saveBoardInTransaction(client, before, board, author);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listCalendarRevisions(month: string): Promise<CalendarRevision[]> {
  await ensureProgramBoardTable();
  const { rows } = await pool.query<{
    id: string;
    month: string;
    events: unknown;
    author: string;
    createdAt: Date;
  }>(
    `SELECT id::text, month, events, author, created_at AS "createdAt"
     FROM program_board_calendar_revisions
     WHERE month = $1
     ORDER BY created_at DESC, id DESC`,
    [month],
  );
  return rows.map((row) => {
    const storedEvents = typeof row.events === "string" ? JSON.parse(row.events) : row.events;
    const parsed = parseCalendar({ events: storedEvents, upcoming: [] });
    if (!parsed) throw new Error(`Stored calendar revision ${row.id} is invalid`);
    return {
      id: row.id,
      month: row.month,
      events: parsed.events,
      author: row.author,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function restoreCalendarRevision(
  revisionId: string,
  month: string,
  expectedUpdatedAt: string | null,
  author?: unknown,
): Promise<ProgramBoardResponse> {
  await ensureProgramBoardTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [71942, ROW_ID]);
    const before = await readBoardForUpdate(client);
    assertExpectedVersion(before, expectedUpdatedAt);
    const { rows } = await client.query<{ events: unknown }>(
      "SELECT events FROM program_board_calendar_revisions WHERE id = $1 AND month = $2",
      [revisionId, month],
    );
    if (!rows[0]) throw new ProgramBoardRevisionNotFoundError();
    const targetEvents = typeof rows[0].events === "string" ? JSON.parse(rows[0].events) : rows[0].events;
    const targetCalendar = parseCalendar({ events: targetEvents, upcoming: [] });
    if (!targetCalendar) throw new Error(`Stored calendar revision ${revisionId} is invalid`);
    const otherMonthIds = new Set(
      before.board.calendar.events
        .filter((event) => !event.date.startsWith(`${month}-`))
        .map((event) => event.id),
    );
    if (targetCalendar.events.some((event) => otherMonthIds.has(event.id))) {
      throw new ProgramBoardRevisionConflictError();
    }
    const nextEvents = [
      ...before.board.calendar.events.filter((event) => !event.date.startsWith(`${month}-`)),
      ...targetCalendar.events,
    ];
    const parsed = parseProgramBoardBody({
      ...before.board,
      calendar: { ...before.board.calendar, events: nextEvents },
    });
    if (!parsed.ok) throw new Error(`Restored program board is invalid: ${parsed.error}`);
    if (changedMonths(before.board, parsed.board).length === 0) {
      await client.query("COMMIT");
      return toResponse(before.board, before.updatedAt);
    }
    const result = await saveBoardInTransaction(client, before, parsed.board, author);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
