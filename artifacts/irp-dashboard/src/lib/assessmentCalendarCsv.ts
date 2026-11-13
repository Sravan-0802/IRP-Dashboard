import {
  isIsoDate,
  MAX_CALENDAR_EVENTS,
  monthPrefix,
  safeHttpUrl,
  type CalendarEvent,
  type CalendarMode,
  type CalendarProgram,
} from "@/lib/programBoard";

export const CSV_MAX_BYTES = 512 * 1024;
export const CSV_MAX_ROWS = 500;

export const REQUIRED_HEADERS = ["Assessment Name", "Assessment Date", "Assessment Mode", "Assessment Link"] as const;
export const OPTIONAL_HEADERS = ["Program"] as const;

export const CSV_TEMPLATE = [
  "Assessment Name,Assessment Date,Assessment Mode,Assessment Link,Program",
  'L1 Online Assessment,2030-01-10,Online,https://example.com/assessments/l1,MERN',
  '"Mock Assessment, Set A",2030-01-17,Online,https://example.com/assessments/mock-a,GenAI',
  "Campus Interview Round,2030-01-24,Offline,https://example.com/assessments/venue,MERN",
].join("\r\n") + "\r\n";

export interface CsvRowError {
  /** 1-based line in the spreadsheet, header is row 1. 0 means the whole file. */
  row: number;
  message: string;
}

export interface CsvImportResult {
  events: CalendarEvent[];
  errors: CsvRowError[];
}

/** RFC 4180 parser: quoted commas, newlines inside quotes, doubled quotes, BOM, CRLF. */
export function parseCsv(text: string): { rows: string[][]; error: string | null } {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let quotedCell = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      if (cell.trim() !== "" || quotedCell) return { rows, error: `Unexpected quote on row ${rows.length + 1}` };
      inQuotes = true;
      quotedCell = true;
      cell = "";
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
      quotedCell = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      quotedCell = false;
    } else {
      if (quotedCell && ch.trim() !== "") return { rows, error: `Text after closing quote on row ${rows.length + 1}` };
      cell += ch;
    }
  }
  if (inQuotes) return { rows, error: "A quoted value is not closed" };
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return { rows: rows.filter((r) => r.some((c) => c.trim() !== "")), error: null };
}

const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");

function parseProgram(value: string): CalendarProgram | null {
  const v = value.trim().toLowerCase();
  if (v === "" || v === "mern" || v === "irp") return "irp";
  if (v === "genai" || v === "gen ai") return "genai";
  return null;
}

function parseMode(value: string): CalendarMode | null {
  const v = value.trim().toLowerCase();
  return v === "online" ? "online" : v === "offline" ? "offline" : null;
}

/**
 * Validates an assessment CSV for one month. All-or-nothing: if any error is
 * returned, `events` is empty so nothing can be partially applied.
 */
export function importAssessmentCsv(
  text: string,
  year: number,
  month: number,
  makeId: () => string,
): CsvImportResult {
  if (text.length > CSV_MAX_BYTES) return { events: [], errors: [{ row: 0, message: "File is larger than 512 KB" }] };
  const parsed = parseCsv(text);
  if (parsed.error) return { events: [], errors: [{ row: 0, message: parsed.error }] };
  const [header, ...body] = parsed.rows;
  if (!header) return { events: [], errors: [{ row: 0, message: "File is empty" }] };
  const cols = header.map(norm);
  const index = (name: string) => cols.indexOf(norm(name));
  const missing = REQUIRED_HEADERS.filter((h) => index(h) === -1);
  if (missing.length) return { events: [], errors: [{ row: 1, message: `Missing column: ${missing.join(", ")}` }] };
  const dupes = cols.filter((c, i) => c && cols.indexOf(c) !== i);
  if (dupes.length) return { events: [], errors: [{ row: 1, message: `Duplicate column: ${dupes.join(", ")}` }] };
  if (body.length === 0) return { events: [], errors: [{ row: 0, message: "No assessment rows found" }] };
  if (body.length > CSV_MAX_ROWS) return { events: [], errors: [{ row: 0, message: `Too many rows (max ${CSV_MAX_ROWS})` }] };

  const prefix = `${monthPrefix(year, month)}-`;
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const [iName, iDate, iMode, iLink] = REQUIRED_HEADERS.map(index);
  const iProgram = index("Program");
  const errors: CsvRowError[] = [];
  const events: CalendarEvent[] = [];

  body.forEach((cells, i) => {
    const row = i + 2;
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");
    const name = get(iName);
    const date = get(iDate);
    const mode = parseMode(get(iMode));
    const link = safeHttpUrl(get(iLink));
    const program = parseProgram(get(iProgram));
    const problems: string[] = [];
    if (cells.length > header.length) problems.push("has more cells than headers");
    if (!name) problems.push("Assessment Name is blank");
    else if (name.length > 200) problems.push("Assessment Name is over 200 characters");
    if (!isIsoDate(date)) problems.push(`Assessment Date "${date}" is not a valid YYYY-MM-DD date`);
    else if (!date.startsWith(prefix)) problems.push(`Assessment Date ${date} is outside ${monthLabel}`);
    if (!mode) problems.push(`Assessment Mode "${get(iMode)}" must be Online or Offline`);
    if (!link) problems.push("Assessment Link must be a full http:// or https:// URL");
    if (!program) problems.push(`Program "${get(iProgram)}" must be MERN, IRP or GenAI`);
    if (problems.length) {
      errors.push({ row, message: problems.join("; ") });
      return;
    }
    events.push({ id: makeId(), date, label: name, mode: mode!, link: link!, program: program! });
  });

  return errors.length ? { events: [], errors } : { events: events.sort((a, b) => a.date.localeCompare(b.date)), errors };
}

/** Replace only the selected month's entries; every other month is kept untouched. */
export function replaceMonthEvents(
  all: CalendarEvent[],
  year: number,
  month: number,
  incoming: CalendarEvent[],
): CalendarEvent[] {
  const prefix = `${monthPrefix(year, month)}-`;
  if (incoming.some((event) => !isIsoDate(event.date) || !event.date.startsWith(prefix))) {
    throw new Error("The uploaded assessments do not match the selected month. Upload the file again.");
  }
  const next = [...all.filter((e) => !e.date.startsWith(prefix)), ...incoming];
  if (next.length > MAX_CALENDAR_EVENTS) {
    throw new Error(`This import would exceed the ${MAX_CALENDAR_EVENTS}-assessment calendar limit. Remove older entries first.`);
  }
  return next;
}
