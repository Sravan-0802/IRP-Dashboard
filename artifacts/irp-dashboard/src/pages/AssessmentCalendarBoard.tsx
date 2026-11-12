import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles, Target, type LucideIcon } from "lucide-react";
import { useProgramBoard } from "@/lib/useProgramBoard";
import type { CalendarEvent, CalendarUpcoming } from "@/lib/programBoard";

type Program = "irp" | "genai";
type ProgramFilter = "all" | Program;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const PROGRAM_STYLE: Record<Program, { chip: string; label: string; bar: string; name: string }> = {
  irp: {
    chip: "bg-[#f4f3ff] text-[#5925dc]",
    label: "text-[#6941c6]",
    bar: "bg-[#6941c6]",
    name: "MERN",
  },
  genai: {
    chip: "bg-[#eff8ff] text-[#175cd3]",
    label: "text-[#175cd3]",
    bar: "bg-[#175cd3]",
    name: "GenAI",
  },
};

function monthCells(year: number, month: number): Date[] {
  const startPad = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((startPad + count) / 7) * 7;
  const start = new Date(year, month, 1 - startPad);
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Reads schedule dates like "Sun, 4 Oct", "5 to 14 Oct" or "31 Oct to 1 Nov".
 * Unrecognised text returns null, so that item is simply not shown on a day.
 */
function parseWhenRange(when: string, year: number): { start: Date; end: Date } | null {
  const text = when.trim().replace(/^[a-z]{3,9},\s*/i, "");
  const match = text.match(/^(\d{1,2})(?:\s+([a-z]{3,9}))?(?:\s*(?:to|–|-)\s*(\d{1,2})\s+([a-z]{3,9}))?$/i);
  if (!match) return null;
  const [, d1, m1, d2, m2] = match;
  const startMonth = MONTH_INDEX[(m1 ?? m2 ?? "").slice(0, 3).toLowerCase()];
  if (startMonth == null) return null;
  const start = new Date(year, startMonth, Number(d1));
  if (!d2) return { start, end: start };
  const endMonth = MONTH_INDEX[(m2 ?? "").slice(0, 3).toLowerCase()];
  if (endMonth == null) return null;
  let end = new Date(year, endMonth, Number(d2));
  if (end < start) end = new Date(year + 1, endMonth, Number(d2));
  return { start, end };
}

type DayItem = {
  id: string;
  program: Program;
  title: string;
  schedule: CalendarUpcoming | null;
};

const IGNORED_WORDS = new Set(["the", "and", "for", "genai", "irp", "session", "sessions"]);

function keyWords(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3 && !IGNORED_WORDS.has(word)),
  );
}

function sharesKeyWord(a: string, b: string): boolean {
  const words = keyWords(b);
  for (const word of keyWords(a)) if (words.has(word)) return true;
  return false;
}

/**
 * Calendar chips for one day. A chip takes the full title of the schedule item
 * whose date range covers it only when both name the same thing (same program
 * and a shared key word); otherwise the admin's chip label is shown as typed.
 */
function dayItems(key: string, events: CalendarEvent[], schedule: CalendarUpcoming[]): DayItem[] {
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const items: DayItem[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (event.date !== key) continue;
    let best: { item: CalendarUpcoming; span: number } | null = null;
    for (const item of schedule) {
      if (item.program !== event.program || !sharesKeyWord(event.label, item.title)) continue;
      const range = parseWhenRange(item.when, y);
      if (!range || day < range.start || day > range.end) continue;
      const span = range.end.getTime() - range.start.getTime();
      if (!best || span < best.span) best = { item, span };
    }
    const id = best ? `s:${best.item.id}` : `e:${event.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      program: event.program,
      title: best?.item.title || event.label,
      schedule: best?.item ?? null,
    });
  }
  return items;
}

function chunkWeeks(cells: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const FILTERS: { id: ProgramFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "irp", label: "MERN" },
  { id: "genai", label: "GenAI" },
];

const FILTER_THEME: Record<
  ProgramFilter,
  { title: string; tagline: string; icon: LucideIcon; gradient: string; accent: string }
> = {
  all: {
    title: "All tracks",
    tagline: "Every MERN and GenAI date in one view.",
    icon: CalendarDays,
    gradient: "linear-gradient(135deg, #6941c6 0%, #175cd3 100%)",
    accent: "#6941c6",
  },
  irp: {
    title: "MERN Track",
    tagline: "Online assessments, interviews and other MERN events.",
    icon: Target,
    gradient: "linear-gradient(135deg, #42307d 0%, #7f56d9 100%)",
    accent: "#6941c6",
  },
  genai: {
    title: "GenAI Track",
    tagline: "GenAI training sessions and assessments.",
    icon: Sparkles,
    gradient: "linear-gradient(135deg, #194185 0%, #2e90fa 100%)",
    accent: "#175cd3",
  },
};

export function AssessmentCalendarBoard() {
  const calendar = useProgramBoard().calendar;
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [filter, setFilter] = useState<ProgramFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const visibleEvents = calendar.events.filter((event) => filter === "all" || event.program === filter);
  const visibleUpcoming = calendar.upcoming.filter((item) => filter === "all" || item.program === filter);
  const weeks = useMemo(() => chunkWeeks(cells), [cells]);
  const selectedItems = selectedKey ? dayItems(selectedKey, visibleEvents, visibleUpcoming) : [];
  const selectedLabel = selectedKey
    ? new Date(`${selectedKey}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";
  const theme = FILTER_THEME[filter];
  const ThemeIcon = theme.icon;
  const filterIndex = FILTERS.findIndex((item) => item.id === filter);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const monthEventDays = new Set(
    visibleEvents.filter((event) => event.date.startsWith(monthPrefix)).map((event) => event.date),
  ).size;
  const monthName = cursor.toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#101828] sm:text-[28px]">
            Assessment Calendar
          </h1>
          <p className="mt-1 text-sm text-[#667085]">MERN and GenAI dates for your batch.</p>
        </div>
        <div className="relative grid w-[15rem] grid-cols-3 rounded-full bg-[#f2f4f7] p-1" role="tablist" aria-label="Program">
          <span
            aria-hidden
            className="absolute bottom-1 left-1 top-1 rounded-full shadow-md transition-all duration-300 ease-out"
            style={{
              width: "calc((100% - 0.5rem) / 3)",
              transform: `translateX(${filterIndex * 100}%)`,
              background: theme.gradient,
            }}
          />
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`tab-calendar-${item.id}`}
                onClick={() => setFilter(item.id)}
                className={`relative z-10 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-300 ${
                  active ? "text-white" : "text-[#667085] hover:text-[#344054]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        key={filter}
        className="animate-pop-in relative overflow-hidden rounded-2xl px-5 py-4 text-white shadow-[0_10px_30px_rgba(16,24,40,0.12)] sm:px-6"
        style={{ background: theme.gradient }}
        data-testid="calendar-track-banner"
      >
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-14 h-40 w-40 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 h-32 w-32 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <ThemeIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold tracking-tight">{theme.title}</p>
            <p className="text-sm text-white/80">{theme.tagline}</p>
          </div>
          <div className="rounded-xl bg-white/15 px-4 py-2 text-right backdrop-blur-sm">
            <p className="font-display text-2xl font-bold leading-none">{monthEventDays}</p>
            <p className="mt-1 text-[11px] font-semibold text-white/80">
              {monthEventDays === 1 ? "day" : "days"} with events in {monthName}
            </p>
          </div>
        </div>
      </div>

      <div className={`grid items-start gap-4 ${selectedKey ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <section
          className="overflow-hidden rounded-2xl border border-t-[3px] border-[#eaecf0] bg-white transition-colors duration-300"
          style={{ borderTopColor: theme.accent }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaecf0] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setCursor(new Date(year, month - 1, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#344054] hover:bg-[#f2f4f7]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="min-w-[9.5rem] text-center font-display text-base font-extrabold text-[#101828]">
                {monthLabel}
              </h2>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setCursor(new Date(year, month + 1, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#344054] hover:bg-[#f2f4f7]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-[#344054]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#6941c6]" />
                MERN
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#175cd3]" />
                GenAI
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-[#eaecf0] bg-[#f9fafb]">
            {WEEKDAYS.map((day) => (
              <p key={day} className="px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-[#667085]">
                {day}
              </p>
            ))}
          </div>

          {weeks.map((week) => {
            return (
              <div key={dateKey(week[0])}>
                <div className="grid grid-cols-7">
                  {week.map((date) => {
                    const key = dateKey(date);
                    const inMonth = date.getMonth() === month;
                    const items = dayItems(key, visibleEvents, visibleUpcoming);
                    const isToday = isSameDay(date, today);
                    const selected = selectedKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-expanded={selected}
                        onClick={() => setSelectedKey(selected ? null : key)}
                        className={`min-h-[92px] border-b border-r border-[#f2f4f7] p-1.5 text-left sm:min-h-[112px] sm:p-2 ${
                          selected
                            ? "bg-[#f9f5ff] ring-2 ring-inset ring-[#6941c6]"
                            : inMonth
                              ? "bg-white hover:bg-[#fcfcfd]"
                              : "bg-[#fcfcfd]"
                        }`}
                      >
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                            isToday
                              ? "bg-[#6941c6] text-white"
                              : inMonth
                                ? "text-[#344054]"
                                : "text-[#d0d5dd]"
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        <div className="mt-1 space-y-1">
                          {items.slice(0, 3).map((item, itemIndex) => (
                            <p
                              key={`${filter}-${item.id}`}
                              title={item.title}
                              style={{ animationDelay: `${itemIndex * 60}ms` }}
                              className={`animate-pop-in break-words rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight sm:text-[11px] ${PROGRAM_STYLE[item.program].chip}`}
                            >
                              {item.title}
                            </p>
                          ))}
                          {items.length > 3 ? (
                            <p className="px-1 text-[10px] font-semibold text-[#667085]">+{items.length - 3} more</p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!selectedKey ? (
            <p className="px-4 py-3 text-xs text-[#667085] sm:px-5">Select a date to see what's scheduled.</p>
          ) : null}
        </section>

        {selectedKey ? (
          <aside
            className="rounded-2xl border border-[#eaecf0] bg-white p-4 sm:p-5 xl:sticky xl:top-4"
            data-testid="calendar-day-details"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98a2b3]">{selectedLabel}</p>
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className="text-xs font-semibold text-[#6941c6] hover:underline"
              >
                Close
              </button>
            </div>
            {selectedItems.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {selectedItems.map((item) => (
                  <li key={item.id} className="flex gap-2.5 rounded-xl border border-[#eaecf0] bg-white px-3 py-3">
                    <span className={`w-1 shrink-0 self-stretch rounded-full ${PROGRAM_STYLE[item.program].bar}`} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-extrabold leading-snug text-[#101828]">{item.title}</h3>
                      <p className="mt-1 text-xs text-[#667085]">
                        <span className={`font-semibold ${PROGRAM_STYLE[item.program].label}`}>
                          {PROGRAM_STYLE[item.program].name}
                        </span>
                        {item.schedule?.when ? <> · {item.schedule.when}</> : null}
                      </p>
                      {item.schedule?.detail ? (
                        <p className="mt-0.5 text-xs text-[#667085]">{item.schedule.detail}</p>
                      ) : null}
                      {item.schedule ? <UpcomingAction item={item.schedule} /> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#667085]">Nothing scheduled.</p>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function UpcomingAction({ item }: { item: CalendarUpcoming }) {
  if (item.action === "register" || item.action === "submit") {
    return (
      <button
        type="button"
        className="mt-2 rounded-lg bg-[#6941c6] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#5925dc]"
      >
        {item.action === "register" ? "Register" : "Submit"}
      </button>
    );
  }
  if (item.badge === "not-registered") {
    return (
      <span className="mt-2 inline-flex rounded-full bg-[#fffaeb] px-2 py-1 text-[10px] font-bold tracking-wide text-[#b54708]">
        NOT REGISTERED
      </span>
    );
  }
  if (item.badge === "locked") {
    return (
      <span className="mt-2 inline-flex rounded-full bg-[#f2f4f7] px-2 py-1 text-[10px] font-bold tracking-wide text-[#667085]">
        LOCKED
      </span>
    );
  }
  if (item.badge === "upcoming") {
    return (
      <span className="mt-2 inline-flex rounded-full bg-[#f2f4f7] px-2 py-1 text-[10px] font-bold tracking-wide text-[#667085]">
        UPCOMING
      </span>
    );
  }
  return null;
}
