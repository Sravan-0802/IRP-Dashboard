import { GENAI_TRAINING_LIVE_URL } from "@/lib/genAiTrainingConfig";
import { NXTMOCK_MOCK_URL } from "@/lib/nxtmockConfig";

export type HintTone = "default" | "warn";
export type AssessmentStatus = "completed" | "open" | "upcoming";
export type CalendarProgram = "irp" | "genai";
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
  label: string;
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

