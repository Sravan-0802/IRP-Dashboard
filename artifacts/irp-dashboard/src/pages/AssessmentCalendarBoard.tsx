import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useProgramBoard } from "@/lib/useProgramBoard";
import type { CalendarUpcoming } from "@/lib/programBoard";

type Program = "irp" | "genai";
type ProgramFilter = "all" | Program;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const PROGRAM_STYLE: Record<Program, { chip: string; label: string; bar: string; name: string }> = {
  irp: {
    chip: "bg-[#f4f3ff] text-[#5925dc]",
    label: "text-[#6941c6]",
    bar: "bg-[#6941c6]",
    name: "IRP",
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

const FILTERS: { id: ProgramFilter; label: string }[] = [
  { id: "all", label: "All programs" },
  { id: "irp", label: "IRP" },
  { id: "genai", label: "GenAI" },
];

export function AssessmentCalendarBoard() {
  const calendar = useProgramBoard().calendar;
  const [cursor, setCursor] = useState(() => new Date(2026, 9, 1));
  const [filter, setFilter] = useState<ProgramFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const visibleEvents = calendar.events.filter((event) => filter === "all" || event.program === filter);
  const visibleUpcoming = calendar.upcoming.filter((item) => filter === "all" || item.program === filter);
  const selectedEvents = selectedKey ? visibleEvents.filter((event) => event.date === selectedKey) : [];
  const selectedLabel = selectedKey
    ? new Date(`${selectedKey}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#101828] sm:text-[28px]">
            Assessment Calendar
          </h1>
          <p className="mt-1 text-sm text-[#667085]">IRP and GenAI dates for your batch.</p>
        </div>
        <div className="inline-flex rounded-full bg-[#f2f4f7] p-1" role="tablist" aria-label="Program">
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.id)}
                className={
                  active
                    ? "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#101828] shadow-sm"
                    : "rounded-full px-3 py-1.5 text-xs font-semibold text-[#667085]"
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-2xl border border-[#eaecf0] bg-white">
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
                IRP
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

          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const key = dateKey(date);
              const inMonth = date.getMonth() === month;
              const events = visibleEvents.filter((event) => event.date === key);
              const isToday = isSameDay(date, today);
              const selected = selectedKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(selected ? null : key)}
                  className={`min-h-[92px] border-b border-r border-[#f2f4f7] p-1.5 text-left sm:min-h-[108px] sm:p-2 ${
                    selected ? "bg-[#f9f5ff]" : inMonth ? "bg-white hover:bg-[#fcfcfd]" : "bg-[#fcfcfd]"
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
                    {events.slice(0, 2).map((event) => (
                      <p
                        key={event.id}
                        title={event.label}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight sm:text-[11px] ${PROGRAM_STYLE[event.program].chip}`}
                      >
                        {event.label}
                      </p>
                    ))}
                    {events.length > 2 ? (
                      <p className="px-1 text-[10px] font-semibold text-[#667085]">+{events.length - 2} more</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-2xl border border-[#eaecf0] bg-white p-4 sm:p-5">
          {selectedKey ? (
            <div className="mb-4 border-b border-[#f2f4f7] pb-4">
              <p className="text-[11px] font-semibold tracking-wide text-[#98a2b3]">SELECTED DAY</p>
              <h2 className="mt-1 font-display text-base font-extrabold text-[#101828]">{selectedLabel}</h2>
              {selectedEvents.length === 0 ? (
                <p className="mt-2 text-sm text-[#667085]">Nothing scheduled.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {selectedEvents.map((event) => (
                    <li
                      key={event.id}
                      className={`rounded-lg px-2.5 py-2 text-sm font-semibold ${PROGRAM_STYLE[event.program].chip}`}
                    >
                      {event.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <h2 className="font-display text-base font-extrabold text-[#101828]">Schedule</h2>
          {visibleUpcoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#667085]">Nothing scheduled for this program.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#f2f4f7]">
              {visibleUpcoming.map((item) => (
                <li key={item.id} className="flex gap-3 py-3">
                  <span className={`w-1 shrink-0 self-stretch rounded-full ${PROGRAM_STYLE[item.program].bar}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-[#667085]">
                      <span className={PROGRAM_STYLE[item.program].label}>{PROGRAM_STYLE[item.program].name}</span>
                      <span className="mx-1.5 text-[#d0d5dd]">·</span>
                      {item.when}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-[#101828]">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-snug text-[#667085]">{item.detail}</p>
                    <UpcomingAction item={item} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
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
