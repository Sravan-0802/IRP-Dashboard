import { db, pool, programBoardTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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
    if ((event.mode !== undefined && !link) || (event.link !== undefined && typeof event.link !== "string")) {
      return { ok: false, error: prefix + "an assessment link is required" };
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

export async function updateProgramBoard(board: ProgramBoardContent, expectedUpdatedAt?: string | null): Promise<ProgramBoardResponse> {
  await ensureProgramBoardTable();
  const payload = JSON.stringify(board);
  const [row] = await db
    .insert(programBoardTable)
    .values({ id: ROW_ID, payload })
    .onConflictDoUpdate({
      target: programBoardTable.id,
      set: { payload, updatedAt: new Date() },
      // JS timestamps use milliseconds, while legacy Postgres defaults retain microseconds.
      ...(expectedUpdatedAt === undefined ? {} : {
        setWhere: expectedUpdatedAt === null
          ? sql`false`
          : sql`date_trunc('milliseconds', ${programBoardTable.updatedAt}) = ${expectedUpdatedAt}::timestamptz`,
      }),
    })
    .returning();
  if (!row) throw new ProgramBoardConflictError();
  return toResponse(board, row.updatedAt);
}
