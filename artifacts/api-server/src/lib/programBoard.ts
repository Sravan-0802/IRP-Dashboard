import { db, pool, programBoardTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const ROW_ID = 1;
const MAX_ITEMS = 40;
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

export const PROGRAM_BOARD_DEFAULTS = {
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
    events: [
      { id: "e1", date: "2026-10-04", program: "irp", label: "L1 Assessment" },
      { id: "e2", date: "2026-10-05", program: "genai", label: "Training C3" },
      { id: "e3", date: "2026-10-07", program: "genai", label: "Training C3" },
      { id: "e4", date: "2026-10-09", program: "genai", label: "Training C3" },
      { id: "e5", date: "2026-10-10", program: "irp", label: "Ask an Achiever" },
      { id: "e6", date: "2026-10-11", program: "irp", label: "Interview" },
      { id: "e7", date: "2026-10-12", program: "irp", label: "Contest starts" },
      { id: "e8", date: "2026-10-12", program: "genai", label: "Training C3" },
      { id: "e9", date: "2026-10-14", program: "genai", label: "Training C3" },
      { id: "e10", date: "2026-10-17", program: "genai", label: "Mock" },
      { id: "e11", date: "2026-10-18", program: "genai", label: "Main" },
      { id: "e12", date: "2026-10-19", program: "irp", label: "Contest ends" },
      { id: "e13", date: "2026-10-19", program: "genai", label: "Training C4" },
      { id: "e14", date: "2026-10-21", program: "genai", label: "Training C4" },
      { id: "e15", date: "2026-10-23", program: "genai", label: "Training C4" },
      { id: "e16", date: "2026-10-26", program: "genai", label: "Training C4" },
      { id: "e17", date: "2026-10-28", program: "genai", label: "Training C4" },
      { id: "e18", date: "2026-10-31", program: "genai", label: "Mock" },
      { id: "e19", date: "2026-11-01", program: "genai", label: "Main" },
    ],
    upcoming: [
      { id: "u1", program: "irp", when: "Sun, 4 Oct", title: "L1 Hustler Online Assessment", detail: "Online assessment", action: "", badge: "" },
      { id: "u2", program: "genai", when: "5 to 14 Oct", title: "GenAI Training Sessions (Cycle 3)", detail: "Monday, Wednesday, Friday", action: "", badge: "" },
      { id: "u3", program: "irp", when: "Sat, 10 Oct", title: "Ask an Achiever", detail: "Student who secured an internship through IRP", action: "", badge: "" },
      { id: "u4", program: "irp", when: "Sun, 11 Oct", title: "Human Interview Sessions", detail: "Interview sessions", action: "", badge: "" },
      { id: "u5", program: "irp", when: "12 to 19 Oct", title: "IRP Logo Design Contest", detail: "Starts 12 Oct · Ends 19 Oct", action: "", badge: "" },
      { id: "u6", program: "genai", when: "Sat, 17 Oct", title: "GenAI Assessment Mock", detail: "Mock assessment", action: "", badge: "" },
      { id: "u7", program: "genai", when: "Sun, 18 Oct", title: "GenAI Assessment Main", detail: "Main assessment", action: "", badge: "" },
      { id: "u8", program: "genai", when: "19 to 28 Oct", title: "GenAI Training Sessions (Cycle 4)", detail: "For priority individuals", action: "", badge: "" },
      { id: "u9", program: "genai", when: "31 Oct to 1 Nov", title: "GenAI Assessment Mock & Main", detail: "Mock on 31 Oct · Main on 1 Nov", action: "", badge: "" },
    ],
  },
};

export type ProgramBoardContent = typeof PROGRAM_BOARD_DEFAULTS;

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
    events: asList(row.events).map((item, index) => {
      const event = asRecord(item);
      const date = text(event?.date, 10);
      return {
        id: idOf(event?.id, "event", index),
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
        program: oneOf(event?.program, ["irp", "genai"] as const, "irp"),
        label: text(event?.label, 80),
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
  try {
    const parsed = parseProgramBoardBody(JSON.parse(row.payload));
    if (!parsed.ok) return toResponse(PROGRAM_BOARD_DEFAULTS, row.updatedAt);
    return toResponse(parsed.board, row.updatedAt);
  } catch {
    return toResponse(PROGRAM_BOARD_DEFAULTS, row.updatedAt);
  }
}

export async function updateProgramBoard(board: ProgramBoardContent): Promise<ProgramBoardResponse> {
  await ensureProgramBoardTable();
  const payload = JSON.stringify(board);
  const [row] = await db
    .insert(programBoardTable)
    .values({ id: ROW_ID, payload })
    .onConflictDoUpdate({
      target: programBoardTable.id,
      set: { payload, updatedAt: new Date() },
    })
    .returning();
  return toResponse(board, row?.updatedAt ?? new Date());
}
