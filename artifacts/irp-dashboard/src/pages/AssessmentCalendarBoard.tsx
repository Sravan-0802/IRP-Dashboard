import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Sparkles, Target, type LucideIcon } from "lucide-react";
import { useProgramBoardQuery } from "@/lib/useProgramBoard";
import { MODE_NAME, PROGRAM_NAME, monthPrefix, safeHttpUrl, type CalendarEvent, type CalendarProgram } from "@/lib/programBoard";

type ProgramFilter = "all" | CalendarProgram;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString("en-US", { month: "long" }));

const PROGRAM_STYLE: Record<CalendarProgram, { chip: string; label: string; bar: string }> = {
  irp: { chip: "bg-[#f4f3ff] text-[#5925dc] hover:bg-[#ebe9fe]", label: "text-[#6941c6]", bar: "bg-[#6941c6]" },
  genai: { chip: "bg-[#eff8ff] text-[#175cd3] hover:bg-[#d1e9ff]", label: "text-[#175cd3]", bar: "bg-[#175cd3]" },
};

const FILTERS: { id: ProgramFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "irp", label: "MERN" },
  { id: "genai", label: "GenAI" },
];

const FILTER_THEME: Record<ProgramFilter, { title: string; tagline: string; icon: LucideIcon; gradient: string; accent: string }> = {
  all: { title: "All tracks", tagline: "Every MERN and GenAI assessment in one view.", icon: CalendarDays, gradient: "linear-gradient(135deg, #6941c6 0%, #175cd3 100%)", accent: "#6941c6" },
  irp: { title: "MERN Track", tagline: "MERN assessments for your batch.", icon: Target, gradient: "linear-gradient(135deg, #42307d 0%, #7f56d9 100%)", accent: "#6941c6" },
  genai: { title: "GenAI Track", tagline: "GenAI assessments for your batch.", icon: Sparkles, gradient: "linear-gradient(135deg, #194185 0%, #2e90fa 100%)", accent: "#175cd3" },
};

function monthCells(year: number, month: number): Date[] {
  const startPad = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((startPad + count) / 7) * 7;
  return Array.from({ length: total }, (_, i) => new Date(year, month, 1 - startPad + i));
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** One clickable assessment. Without a safe link it renders as plain text with "Link pending". */
function AssessmentChip({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  const href = safeHttpUrl(event.link);
  const mode = event.mode ? MODE_NAME[event.mode] : null;
  const style = PROGRAM_STYLE[event.program];
  const tag = mode ? (
    <span data-testid={`tag-assessment-mode-${event.id}`} className={`shrink-0 rounded px-1 text-[9px] font-bold uppercase tracking-wide ${event.mode === "online" ? "bg-[#ecfdf3] text-[#067647]" : "bg-[#fffaeb] text-[#b54708]"}`}>
      {mode}
    </span>
  ) : null;
  if (compact) {
    const body = (
      <>
        <span className="line-clamp-2 break-words">{event.label}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1">
          {tag}
          {!href ? <span className="text-[9px] font-semibold text-[#98a2b3]">Link pending</span> : null}
        </span>
      </>
    );
    const cls = `block w-full rounded px-1.5 py-1 text-left text-[10px] font-semibold leading-tight sm:text-[11px] ${style.chip}`;
    return href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" title={event.label} data-testid={`link-assessment-${event.id}`} onClick={(e) => e.stopPropagation()} className={cls}>{body}</a>
    ) : (
      <span title={`${event.label} (link pending)`} data-testid={`text-assessment-${event.id}`} className={`${cls} opacity-80`}>{body}</span>
    );
  }
  return (
    <li className="flex gap-2.5 rounded-xl border border-[#eaecf0] bg-white px-3 py-3" data-testid={`card-assessment-${event.id}`}>
      <span className={`w-1 shrink-0 self-stretch rounded-full ${style.bar}`} />
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-sm font-extrabold leading-snug text-[#101828]" data-testid={`text-assessment-name-${event.id}`}>{event.label}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#667085]">
          <span className={`font-semibold ${style.label}`}>{PROGRAM_NAME[event.program]}</span>
          {tag}
        </p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" data-testid={`link-open-assessment-${event.id}`} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#6941c6] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#5925dc]">
            Open assessment <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="mt-2 text-xs font-semibold text-[#b54708]" data-testid={`text-link-pending-${event.id}`}>Link pending. The program team will add it soon.</p>
        )}
      </div>
    </li>
  );
}

export function AssessmentCalendarBoard() {
  const boardQuery = useProgramBoardQuery();
  const events = useMemo(() => boardQuery.data?.calendar.events ?? [], [boardQuery.data]);
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [filter, setFilter] = useState<ProgramFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (filter !== "all" && e.program !== filter) continue;
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events, filter]);
  const years = useMemo(() => {
    const set = new Set<number>([today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1, year]);
    for (const e of events) {
      const y = Number(e.date.slice(0, 4));
      if (y > 1900 && y < 3000) set.add(y);
    }
    return [...set].sort((a, b) => a - b);
  }, [events, today, year]);

  const prefix = `${monthPrefix(year, month)}-`;
  const monthCount = [...byDate.entries()].filter(([k]) => k.startsWith(prefix)).reduce((n, [, l]) => n + l.length, 0);
  const monthEvents = [...byDate.entries()].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b));
  const theme = FILTER_THEME[filter];
  const ThemeIcon = theme.icon;
  const filterIndex = FILTERS.findIndex((f) => f.id === filter);
  const selectedItems = selectedKey ? byDate.get(selectedKey) ?? [] : [];
  const todayKey = dateKey(today);

  function go(y: number, m: number) {
    const d = new Date(y, m, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedKey(null);
  }

  if (!boardQuery.data && boardQuery.isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading calendar" data-testid="status-calendar-loading">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[#eaecf0]" />
        <div className="h-20 animate-pulse rounded-2xl bg-[#eaecf0]" />
        <div className="h-[420px] animate-pulse rounded-2xl bg-[#f2f4f7]" />
      </div>
    );
  }

  if (!boardQuery.data && boardQuery.isError) {
    return (
      <section className="rounded-xl border border-[#fecdca] bg-white p-5" role="alert">
        <h1 className="font-display text-lg font-extrabold text-[#b42318]">Calendar could not be loaded</h1>
        <p className="mt-1 text-sm text-[#667085]">The latest saved schedule is unavailable. Try again to reload it.</p>
        <button type="button" data-testid="button-retry-calendar" onClick={() => void boardQuery.refetch()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#6941c6] px-3 py-2 text-xs font-bold text-white">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {boardQuery.isError ? (
        <p className="rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-xs font-semibold text-[#93370d]" role="status" data-testid="status-calendar-stale">
          Could not refresh the calendar. Showing the last successfully loaded schedule.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#101828] sm:text-[28px]">Assessment Calendar</h1>
          <p className="mt-1 text-sm text-[#667085]">Every scheduled assessment. Tap one to open it.</p>
        </div>
        <div className="relative grid w-[15rem] grid-cols-3 rounded-full bg-[#f2f4f7] p-1" role="tablist" aria-label="Program">
          <span aria-hidden className="absolute bottom-1 left-1 top-1 rounded-full shadow-md transition-transform duration-300 ease-out" style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${filterIndex * 100}%)`, background: theme.gradient }} />
          {FILTERS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} data-testid={`tab-calendar-${item.id}`} onClick={() => setFilter(item.id)} className={`relative z-10 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-300 ${filter === item.id ? "text-white" : "text-[#667085] hover:text-[#344054]"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div key={filter} className="animate-pop-in relative overflow-hidden rounded-2xl px-5 py-4 text-white shadow-[0_10px_30px_rgba(16,24,40,0.12)] sm:px-6" style={{ background: theme.gradient }} data-testid="calendar-track-banner">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-14 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><ThemeIcon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold tracking-tight">{theme.title}</p>
            <p className="text-sm text-white/80">{theme.tagline}</p>
          </div>
          <div className="rounded-xl bg-white/15 px-4 py-2 text-right">
            <p className="font-display text-2xl font-bold leading-none" data-testid="text-month-assessment-count">{monthCount}</p>
            <p className="mt-1 text-[11px] font-semibold text-white/80">{monthCount === 1 ? "assessment" : "assessments"} in {MONTHS[month]}</p>
          </div>
        </div>
      </div>

      <div className={`grid items-start gap-4 ${selectedKey ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <section className="overflow-hidden rounded-2xl border border-t-[3px] border-[#eaecf0] bg-white" style={{ borderTopColor: theme.accent }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaecf0] px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" aria-label="Previous month" data-testid="button-calendar-prev" onClick={() => go(year, month - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#344054] hover:bg-[#f2f4f7]">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select aria-label="Month" data-testid="select-calendar-month" value={month} onChange={(e) => go(year, Number(e.target.value))} className="rounded-lg border border-[#d0d5dd] bg-white px-2 py-1 text-sm font-bold text-[#101828]">
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select aria-label="Year" data-testid="select-calendar-year" value={year} onChange={(e) => go(Number(e.target.value), month)} className="rounded-lg border border-[#d0d5dd] bg-white px-2 py-1 text-sm font-bold text-[#101828]">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button type="button" aria-label="Next month" data-testid="button-calendar-next" onClick={() => go(year, month + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#344054] hover:bg-[#f2f4f7]">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button type="button" data-testid="button-calendar-today" onClick={() => go(today.getFullYear(), today.getMonth())} className="ml-1 rounded-lg border border-[#d0d5dd] px-2.5 py-1 text-xs font-semibold text-[#344054] hover:bg-[#f9fafb]">
                Today
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-[#344054]">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#6941c6]" />MERN</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#175cd3]" />GenAI</span>
            </div>
          </div>

          {/* Desktop / tablet month grid */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-7 border-b border-[#eaecf0] bg-[#f9fafb]">
              {WEEKDAYS.map((d) => <p key={d} className="px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-[#667085]">{d}</p>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((date) => {
                const key = dateKey(date);
                const inMonth = date.getMonth() === month;
                const items = byDate.get(key) ?? [];
                const selected = selectedKey === key;
                return (
                  <div key={key} data-testid={`cell-calendar-${key}`} className={`min-h-[120px] border-b border-r border-[#f2f4f7] p-2 ${selected ? "bg-[#f9f5ff] ring-2 ring-inset ring-[#6941c6]" : inMonth ? "bg-white" : "bg-[#fcfcfd]"}`}>
                    <button type="button" aria-label={`Show ${key}`} aria-expanded={selected} data-testid={`button-calendar-day-${key}`} onClick={() => setSelectedKey(selected ? null : key)} className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${key === todayKey ? "bg-[#6941c6] text-white" : inMonth ? "text-[#344054] hover:bg-[#f2f4f7]" : "text-[#d0d5dd]"}`}>
                      {date.getDate()}
                    </button>
                    <div className="mt-1 space-y-1">
                      {items.slice(0, 3).map((e) => <AssessmentChip key={e.id} event={e} compact />)}
                      {items.length > 3 ? (
                        <button type="button" data-testid={`button-calendar-more-${key}`} onClick={() => setSelectedKey(key)} className="px-1 text-[10px] font-semibold text-[#6941c6] hover:underline">
                          +{items.length - 3} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile agenda */}
          <div className="sm:hidden" data-testid="list-calendar-agenda">
            {monthEvents.length === 0 ? null : (
              <ol className="divide-y divide-[#f2f4f7]">
                {monthEvents.map(([key, list]) => {
                  const d = new Date(`${key}T12:00:00`);
                  return (
                    <li key={key} className="flex gap-3 px-4 py-3">
                      <div className={`w-11 shrink-0 rounded-lg py-1 text-center ${key === todayKey ? "bg-[#6941c6] text-white" : "bg-[#f9fafb] text-[#344054]"}`}>
                        <p className="text-[10px] font-semibold uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
                        <p className="font-display text-lg font-extrabold leading-none">{d.getDate()}</p>
                      </div>
                      <ul className="min-w-0 flex-1 space-y-2">{list.map((e) => <AssessmentChip key={e.id} event={e} />)}</ul>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {monthCount === 0 ? (
            <div className="px-4 py-6 text-center sm:px-5" data-testid="text-calendar-empty">
              <p className="text-sm font-semibold text-[#344054]">No assessments scheduled in {MONTHS[month]} {year}.</p>
              <p className="mt-1 text-xs text-[#667085]">Check another month, or come back after the program team publishes the schedule.</p>
            </div>
          ) : !selectedKey ? (
            <p className="hidden px-5 py-3 text-xs text-[#667085] sm:block">Click an assessment to open it, or a date number for details.</p>
          ) : null}
        </section>

        {selectedKey ? (
          <aside className="hidden rounded-2xl border border-[#eaecf0] bg-white p-4 sm:block sm:p-5 xl:sticky xl:top-4" data-testid="calendar-day-details">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98a2b3]">
                {new Date(`${selectedKey}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
              <button type="button" data-testid="button-close-day-details" onClick={() => setSelectedKey(null)} className="text-xs font-semibold text-[#6941c6] hover:underline">Close</button>
            </div>
            {selectedItems.length ? (
              <ul className="mt-3 space-y-2.5">{selectedItems.map((e) => <AssessmentChip key={e.id} event={e} />)}</ul>
            ) : (
              <p className="mt-3 text-sm text-[#667085]">No assessments on this date.</p>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
