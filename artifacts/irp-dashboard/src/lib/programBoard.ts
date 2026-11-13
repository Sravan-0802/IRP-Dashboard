import { GENAI_TRAINING_LIVE_URL } from "@/lib/genAiTrainingConfig";
import { NXTMOCK_MOCK_URL } from "@/lib/nxtmockConfig";

export type HintTone = "default" | "warn";
export type AssessmentStatus = "completed" | "open" | "upcoming";
export type CalendarProgram = "irp" | "genai";
export type CalendarMode = "online" | "offline";
export type UpcomingAction = "" | "register" | "submit";
export type UpcomingBadge = "" | "not-registered" | "upcoming" | "locked";

export interface GenAiStat {
  label: string;
  value: string;
  hint: string;
  hintTone: HintTone;
}

export interface GenAiAssessment {
  id: string;
  label: string;
  title: string;
  when: string;
  score: string;
  note: string;
  noteTone: HintTone;
  status: AssessmentStatus;
  actionLabel: string;
}

export interface GenAiClass {
  day: string;
  date: string;
  title: string;
  time: string;
  duration: string;
  instructor: string;
  action: string;
  live: boolean;
  /** In-app path such as `/`, or an http(s) URL. Empty sends students to the dashboard. */
  link: string;
}

export interface GenAiProgramContent {
  subtitle: string;
  liveBadge: string;
  weekLabel: string;
  classTitle: string;
  weekOf: string;
  classHour: number;
  classMinute: number;
  stats: GenAiStat[];
  assessments: GenAiAssessment[];
  classes: GenAiClass[];
  recordingsEmpty: string;
  portalLabel: string;
  practiceEyebrow: string;
  practiceTitle: string;
  practiceBody: string;
  practiceCta: string;
  aboutTitle: string;
  aboutBody: string;
  syllabusLabel: string;
  communityLabel: string;
  supportLabel: string;
  liveUrl: string;
  portalUrl: string;
  practiceUrl: string;
  syllabusUrl: string;
  communityUrl: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  program: CalendarProgram;
  /** Assessment name shown to students exactly as saved. */
  label: string;
  /** Optional for legacy entries; required for new or imported assessments. */
  mode?: CalendarMode;
  /** Optional for legacy entries; must be a safe http(s) URL for new ones. */
  link?: string;
}

export interface CalendarUpcoming {
  id: string;
  program: CalendarProgram;
  when: string;
  title: string;
  detail: string;
  action: UpcomingAction;
  badge: UpcomingBadge;
}

export interface CalendarContent {
  events: CalendarEvent[];
  upcoming: CalendarUpcoming[];
}

export interface ProgramBoard {
  genai: GenAiProgramContent;
  calendar: CalendarContent;
  updatedAt: string | null;
}

export const DEFAULT_PROGRAM_BOARD: ProgramBoard = {
  updatedAt: null,
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
    liveUrl: GENAI_TRAINING_LIVE_URL,
    portalUrl: "https://learning.ccbp.in/course-live-classes",
    practiceUrl: NXTMOCK_MOCK_URL,
    syllabusUrl: GENAI_TRAINING_LIVE_URL,
    communityUrl: GENAI_TRAINING_LIVE_URL,
  },
  calendar: {
    events: [],
    upcoming: [],
  },
};

export const MAX_CALENDAR_EVENTS = 1000;

/** Returns the URL only when it is an absolute http(s) link; otherwise null. */
export function safeHttpUrl(value: string | undefined | null): string | null {
  const text = (value ?? "").trim();
  if (!text || text.length > 2000) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** "YYYY-MM" for a 0-based month. */
export function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export const PROGRAM_NAME: Record<CalendarProgram, string> = { irp: "MERN", genai: "GenAI" };
export const MODE_NAME: Record<CalendarMode, string> = { online: "Online", offline: "Offline" };

/** Problems with one calendar entry, used before save. Links are optional. */
export function calendarEventProblems(event: CalendarEvent): string[] {
  const problems: string[] = [];
  if (!event.label.trim()) problems.push("Assessment name is required");
  else if (event.label.trim().length > 200) problems.push("Assessment name must be 200 characters or fewer");
  if (!isIsoDate(event.date)) problems.push("Date must be a valid YYYY-MM-DD date");
  if (event.program !== "irp" && event.program !== "genai") problems.push("Program must be MERN or GenAI");
  if (event.mode !== undefined && event.mode !== "online" && event.mode !== "offline") {
    problems.push("Mode must be Online or Offline");
  }
  if (event.link?.trim() && !safeHttpUrl(event.link)) problems.push("Link must be a full http:// or https:// URL");
  return problems;
}

export function isLegacyEvent(event: CalendarEvent): boolean {
  return event.mode === undefined;
}
