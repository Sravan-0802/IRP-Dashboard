import { useEffect, useMemo, useRef, useState } from "react";
import { listAdminCalendarRevisions, restoreAdminCalendarRevision, type CalendarRevision, type ProgramBoardDocument } from "@workspace/api-client-react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileUp, History, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  CSV_TEMPLATE,
  importAssessmentCsv,
  replaceMonthEvents,
  type CsvRowError,
} from "@/lib/assessmentCalendarCsv";
import {
  MODE_NAME,
  PROGRAM_NAME,
  calendarEventProblems,
  isIsoDate,
  isLegacyEvent,
  MAX_CALENDAR_EVENTS,
  monthPrefix,
  type CalendarEvent,
  type CalendarMode,
  type CalendarProgram,
} from "@/lib/programBoard";

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString("en-US", { month: "long" }));
const PAGE_SIZE = 10;

function newId(): string {
  return `assessment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type Preview = { fileName: string; events: CalendarEvent[]; errors: CsvRowError[] };

export function MonthlyCalendarEditor({
  events,
  apiKey,
  updatedAt,
  author,
  dirty,
  onAuthorChange,
  onRestored,
  onEvents,
}: {
  events: CalendarEvent[];
  apiKey: string;
  updatedAt: string | null;
  author: string;
  dirty: boolean;
  onAuthorChange: (author: string) => void;
  onRestored: (board: ProgramBoardDocument) => void;
  onEvents: (events: CalendarEvent[]) => void;
}) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [fileError, setFileError] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [revisions, setRevisions] = useState<CalendarRevision[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<CalendarRevision | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadVersionRef = useRef(0);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const prefix = `${monthPrefix(year, month)}-`;
  const monthLabel = `${MONTHS[month]} ${year}`;
  const monthEvents = useMemo(
    () => events.filter((e) => e.date.startsWith(prefix) || !isIsoDate(e.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [events, prefix],
  );
  const otherCount = events.length - monthEvents.length;
  const pageCount = Math.max(1, Math.ceil(monthEvents.length / PAGE_SIZE));
  const pageEvents = monthEvents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const years = useMemo(() => {
    const set = new Set<number>([thisYear - 1, thisYear, thisYear + 1, thisYear + 2, year]);
    for (const e of events) {
      const y = Number(e.date.slice(0, 4));
      if (y > 1900 && y < 3000) set.add(y);
    }
    return [...set].sort((a, b) => a - b);
  }, [events, year, thisYear]);

  useEffect(() => {
    if (!focusId) return;
    const el = rowRefs.current[focusId];
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    el?.querySelector("input")?.focus();
    setFocusId(null);
  }, [focusId, events]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    setSelectedRevision(null);
    void listAdminCalendarRevisions(
      { month: monthPrefix(year, month) },
      { headers: { "x-api-key": apiKey.trim() }, cache: "no-store" },
    ).then((items) => {
      if (active) {
        if (!Array.isArray(items)) throw new Error("The revision history response was invalid.");
        setRevisions(items);
      }
    }).catch((err: unknown) => {
      const e = err as { data?: { error?: string }; message?: string } | null;
      if (active) setHistoryError(e?.data?.error || e?.message || "Could not load revision history.");
    }).finally(() => {
      if (active) setHistoryLoading(false);
    });
    return () => { active = false; };
  }, [apiKey, month, updatedAt, year]);
  function shift(delta: number) {
    uploadVersionRef.current++;
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setPreview(null);
    setPage(1);
  }

  function patch(id: string, next: Partial<CalendarEvent>) {
    onEvents(events.map((e) => (e.id === id ? { ...e, ...next } : e)));
  }

  function add() {
    if (events.length >= MAX_CALENDAR_EVENTS) {
      setFileError(`The calendar limit is ${MAX_CALENDAR_EVENTS} assessments. Remove an entry before adding another.`);
      return;
    }
    const todayKey = `${prefix}${String(now.getDate()).padStart(2, "0")}`;
    const date = now.getFullYear() === year && now.getMonth() === month ? todayKey : `${prefix}01`;
    const event: CalendarEvent = { id: newId(), date, program: "irp", label: "", mode: "online", link: "" };
    const next = [...events, event];
    const nextMonth = next
      .filter((item) => item.date.startsWith(prefix) || !isIsoDate(item.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    const eventIndex = nextMonth.findIndex((item) => item.id === event.id);
    setPage(Math.floor(eventIndex / PAGE_SIZE) + 1);
    onEvents(next);
    setFocusId(event.id);
  }

  function downloadTemplate() {
    const template = CSV_TEMPLATE.replaceAll("2030-01-", `${monthPrefix(year, month)}-`);
    const blob = new Blob(["\ufeff" + template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assessment-calendar-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | undefined) {
    const version = ++uploadVersionRef.current;
    setFileError("");
    setPreview(null);
    setConfirmed(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setFileError("Choose a .csv file.");
    if (file.size > CSV_MAX_BYTES) return setFileError("File is larger than 512 KB.");
    try {
      const text = await file.text();
      if (version !== uploadVersionRef.current) return;
      const result = importAssessmentCsv(text, year, month, newId);
      setPreview({ fileName: file.name, ...result });
    } catch {
      if (version === uploadVersionRef.current) setFileError("Could not read this file. Try uploading it again.");
    }
  }

  function applyImport() {
    if (!preview || preview.errors.length || !confirmed) return;
    try {
      onEvents(replaceMonthEvents(events, year, month, preview.events));
      setPreview(null);
      setConfirmed(false);
      setPage(1);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Could not apply this import.");
    }
  }

  const currentMonthEvents = events.filter((event) => event.date.startsWith(`${monthPrefix(year, month)}-`));
  const selectedEvents = selectedRevision?.events ?? [];
  const sameAsSelected = selectedRevision
    ? JSON.stringify([...currentMonthEvents].sort((a, b) => a.id.localeCompare(b.id))) ===
      JSON.stringify([...selectedEvents].sort((a, b) => a.id.localeCompare(b.id)))
    : false;

  async function restoreSelectedRevision() {
    if (!selectedRevision || dirty || restoring || sameAsSelected) return;
    const confirmedRestore = window.confirm(
      `Restore ${monthLabel} to the version saved ${new Date(selectedRevision.createdAt).toLocaleString()} by ${selectedRevision.author}? This replaces only ${monthLabel}; other months and GenAI Program content stay unchanged.`,
    );
    if (!confirmedRestore) return;
    setRestoring(true);
    setHistoryError("");
    try {
      const board = await restoreAdminCalendarRevision(
        selectedRevision.id,
        { month: monthPrefix(year, month), expectedUpdatedAt: updatedAt },
        {
          headers: {
            "x-api-key": apiKey.trim(),
            "x-calendar-author": author.trim() || "Admin",
          },
        },
      );
      onRestored(board);
      setSelectedRevision(null);
    } catch (err) {
      const e = err as { data?: { error?: string }; message?: string } | null;
      setHistoryError(e?.data?.error || e?.message || "Could not restore this revision.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-3">
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" aria-label="Previous month" data-testid="button-admin-calendar-prev" onClick={() => shift(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d0d5dd] bg-white text-[#344054]">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <label className="text-[11px] font-semibold text-[#667085]">
            Month
            <select data-testid="select-admin-calendar-month" value={month} onChange={(e) => { uploadVersionRef.current++; setMonth(Number(e.target.value)); setPreview(null); setPage(1); }} className="mt-1 block rounded-lg border border-[#d0d5dd] bg-white px-2.5 py-1.5 text-sm font-medium text-[#101828]">
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-[#667085]">
            Year
            <select data-testid="select-admin-calendar-year" value={year} onChange={(e) => { uploadVersionRef.current++; setYear(Number(e.target.value)); setPreview(null); setPage(1); }} className="mt-1 block rounded-lg border border-[#d0d5dd] bg-white px-2.5 py-1.5 text-sm font-medium text-[#101828]">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button type="button" aria-label="Next month" data-testid="button-admin-calendar-next" onClick={() => shift(1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d0d5dd] bg-white text-[#344054]">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-[#667085]" data-testid="text-admin-calendar-counts">
          <span className="font-bold text-[#101828]">{monthEvents.length}</span> in {monthLabel} · {otherCount} in other months · {events.length}/1000 total
        </p>
      </div>
      <label className="block max-w-xs text-[11px] font-semibold text-[#667085]">
        Change author
        <input
          type="text"
          maxLength={80}
          value={author}
          onChange={(event) => onAuthorChange(event.target.value)}
          placeholder="Admin"
          data-testid="input-calendar-author"
          className="mt-1 w-full rounded-lg border border-[#d0d5dd] bg-white px-2.5 py-1.5 text-sm font-medium text-[#101828]"
        />
        <span className="mt-1 block font-normal">This name is recorded with saved calendar revisions.</span>
      </label>

      <section className="space-y-3 rounded-xl border border-dashed border-[#d6bbfb] bg-[#fcfaff] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#101828]">Upload {monthLabel} schedule</h3>
            <p className="mt-0.5 max-w-xl text-xs text-[#667085]">
              One CSV with Assessment Name, Assessment Date (YYYY-MM-DD), Assessment Mode (Online or Offline) and Assessment Link. Program (MERN or GenAI) is optional and defaults to MERN. Every row must fall in {monthLabel}. Max {CSV_MAX_ROWS} rows, 512 KB.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="button-download-calendar-template" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d0d5dd] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054]">
              <Download className="h-3.5 w-3.5" /> Template
            </button>
            <button type="button" data-testid="button-upload-calendar-csv" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#6941c6] px-3 py-1.5 text-xs font-bold text-white">
              <FileUp className="h-3.5 w-3.5" /> Choose CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" data-testid="input-calendar-csv" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
        </div>
        {fileError ? <p className="text-xs font-semibold text-[#b42318]" data-testid="text-calendar-csv-error">{fileError}</p> : null}

        {preview ? (
          <div className="space-y-3 rounded-lg border border-[#eaecf0] bg-white p-3" data-testid="panel-calendar-import-preview">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#101828]">{preview.fileName}</p>
              <button type="button" data-testid="button-cancel-calendar-import" onClick={() => setPreview(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#667085]">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
            {preview.errors.length ? (
              <div className="rounded-lg border border-[#fecdca] bg-[#fef3f2] p-3" role="alert" data-testid="list-calendar-import-errors">
                <p className="flex items-center gap-1.5 text-xs font-bold text-[#b42318]">
                  <AlertTriangle className="h-3.5 w-3.5" /> Nothing imported. Fix {preview.errors.length} {preview.errors.length === 1 ? "problem" : "problems"} and upload again.
                </p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-[#7a271a]">
                  {preview.errors.map((err, i) => (
                    <li key={i}>{err.row ? <span className="font-bold">Row {err.row}: </span> : null}{err.message}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <div className="max-h-64 overflow-auto rounded-lg border border-[#eaecf0]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#f9fafb] text-[#667085]">
                      <tr><th className="px-2 py-1.5">Date</th><th className="px-2 py-1.5">Assessment</th><th className="px-2 py-1.5">Mode</th><th className="px-2 py-1.5">Program</th><th className="px-2 py-1.5">Link</th></tr>
                    </thead>
                    <tbody>
                      {preview.events.map((e) => (
                        <tr key={e.id} className="border-t border-[#f2f4f7] text-[#344054]">
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono">{e.date}</td>
                          <td className="px-2 py-1.5 font-semibold text-[#101828]">{e.label}</td>
                          <td className="px-2 py-1.5">{e.mode ? MODE_NAME[e.mode] : ""}</td>
                          <td className="px-2 py-1.5">{PROGRAM_NAME[e.program]}</td>
                          <td className="max-w-[16rem] truncate px-2 py-1.5 text-[#6941c6]">{e.link}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="flex items-start gap-2 text-xs text-[#344054]">
                  <input type="checkbox" className="mt-0.5" checked={confirmed} data-testid="checkbox-confirm-calendar-import" onChange={(e) => setConfirmed(e.target.checked)} />
                  <span>
                    Replace the <b>{monthEvents.length}</b> {monthLabel} {monthEvents.length === 1 ? "entry" : "entries"} with these <b>{preview.events.length}</b>. All {otherCount} entries in other months stay as they are. Changes stay unsaved until you press Save.
                  </span>
                </label>
                <button type="button" disabled={!confirmed} data-testid="button-apply-calendar-import" onClick={applyImport} className="rounded-lg bg-[#6941c6] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                  Apply to {monthLabel}
                </button>
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-[#101828]">{monthLabel} assessments</h3>
          <div className="flex items-center gap-2">
            {pageCount > 1 ? (
              <nav aria-label="Assessment rows pagination" className="flex items-center gap-1.5 text-xs text-[#667085]">
                <button type="button" aria-label="Previous assessment page" data-testid="button-admin-calendar-prev-page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded border border-[#d0d5dd] px-2 py-1 font-semibold disabled:opacity-40">Previous</button>
                <span data-testid="text-admin-calendar-page">Page {page} of {pageCount}</span>
                <button type="button" aria-label="Next assessment page" data-testid="button-admin-calendar-next-page" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded border border-[#d0d5dd] px-2 py-1 font-semibold disabled:opacity-40">Next</button>
              </nav>
            ) : null}
            <button type="button" data-testid="button-add-calendar-assessment" onClick={add} className="inline-flex items-center gap-1 rounded-lg border border-[#d0d5dd] px-2.5 py-1 text-xs font-semibold text-[#344054]">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
        {monthEvents.length === 0 ? (
          <p className="rounded-xl border border-[#eaecf0] bg-[#f9fafb] px-4 py-6 text-center text-sm text-[#667085]" data-testid="text-admin-calendar-empty">
            No assessments in {monthLabel}. Upload a CSV or add one.
          </p>
        ) : (
          pageEvents.map((event) => {
            const problems = calendarEventProblems(event);
            const legacy = isLegacyEvent(event) && !event.mode;
            return (
              <div
                key={event.id}
                ref={(el) => { rowRefs.current[event.id] = el; }}
                data-testid={`row-calendar-assessment-${event.id}`}
                className={`grid items-end gap-2 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_9.5rem_8rem_7rem_1.6fr_auto] ${problems.length ? "border-[#fda29b] bg-[#fffbfa]" : "border-[#eaecf0]"}`}
              >
                <Input label="Assessment name" testId={`input-assessment-name-${event.id}`} value={event.label} onChange={(v) => patch(event.id, { label: v })} />
                <Input label="Date" type="date" testId={`input-assessment-date-${event.id}`} value={event.date} onChange={(v) => patch(event.id, { date: v })} />
                <label className="block text-[11px] font-semibold text-[#667085]">
                  Mode
                  <select data-testid={`select-assessment-mode-${event.id}`} value={event.mode ?? ""} onChange={(e) => patch(event.id, { mode: (e.target.value || undefined) as CalendarMode | undefined })} className="mt-1 w-full rounded-lg border border-[#d0d5dd] bg-white px-2.5 py-1.5 text-sm font-medium text-[#101828]">
                    {!event.mode ? <option value="">Not set</option> : null}
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-[#667085]">
                  Program
                  <select data-testid={`select-assessment-program-${event.id}`} value={event.program} onChange={(e) => patch(event.id, { program: e.target.value as CalendarProgram })} className="mt-1 w-full rounded-lg border border-[#d0d5dd] bg-white px-2.5 py-1.5 text-sm font-medium text-[#101828]">
                    <option value="irp">MERN</option>
                    <option value="genai">GenAI</option>
                  </select>
                </label>
                <Input label="Link" placeholder="https://" testId={`input-assessment-link-${event.id}`} value={event.link ?? ""} onChange={(v) => patch(event.id, { link: v === "" && !event.mode ? undefined : v })} />
                <button type="button" data-testid={`button-delete-assessment-${event.id}`} onClick={() => onEvents(events.filter((e) => e.id !== event.id))} className="inline-flex h-9 items-center gap-1 text-xs font-semibold text-[#b42318]">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                {legacy && problems.length === 0 ? (
                  <p className="text-[11px] font-semibold text-[#b54708] sm:col-span-2 lg:col-span-6">Older entry: students see "Link pending" until you set a mode and link.</p>
                ) : null}
                {problems.length ? (
                  <p className="text-[11px] font-semibold text-[#b42318] sm:col-span-2 lg:col-span-6" data-testid={`text-assessment-problems-${event.id}`}>{problems.join(". ")}.</p>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-[#eaecf0] bg-white p-4" data-testid="panel-calendar-revision-history">
        <div className="flex items-start gap-2">
          <History className="mt-0.5 h-4 w-4 text-[#6941c6]" />
          <div>
            <h3 className="text-sm font-extrabold text-[#101828]">{monthLabel} revision history</h3>
            <p className="mt-0.5 text-xs text-[#667085]">Compare a saved version with the current month before restoring it.</p>
          </div>
        </div>
        {historyError ? <p role="alert" data-testid="text-calendar-history-error" className="text-xs font-semibold text-[#b42318]">{historyError}</p> : null}
        {historyLoading ? (
          <p className="flex items-center gap-2 py-2 text-xs text-[#667085]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading revisions…</p>
        ) : revisions.length === 0 ? (
          <p className="text-xs text-[#667085]" data-testid="text-calendar-history-empty">No saved revisions for {monthLabel} yet. A starting version is recorded the first time this month changes.</p>
        ) : (
          <div className="space-y-2" data-testid="list-calendar-revisions">
            {revisions.map((revision) => (
              <button
                key={revision.id}
                type="button"
                aria-pressed={selectedRevision?.id === revision.id}
                data-testid={`button-calendar-revision-${revision.id}`}
                onClick={() => setSelectedRevision(revision)}
                className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left ${selectedRevision?.id === revision.id ? "border-[#6941c6] bg-[#fcfaff]" : "border-[#eaecf0] bg-white"}`}
              >
                <span>
                  <span className="block text-xs font-bold text-[#101828]">{new Date(revision.createdAt).toLocaleString()}</span>
                  <span className="block text-[11px] text-[#667085]">By {revision.author} · {revision.events.length} {revision.events.length === 1 ? "assessment" : "assessments"}</span>
                </span>
                <span className="text-[11px] font-semibold text-[#6941c6]">{selectedRevision?.id === revision.id ? "Compared" : "Compare"}</span>
              </button>
            ))}
          </div>
        )}
        {selectedRevision ? (
          <div className="space-y-3 rounded-lg border border-[#d6bbfb] bg-[#fcfaff] p-3" data-testid="panel-calendar-revision-comparison">
            <div className="grid gap-3 sm:grid-cols-2">
              <ComparisonList title={`Current ${monthLabel}`} events={currentMonthEvents} />
              <ComparisonList
                title={`Saved ${new Date(selectedRevision.createdAt).toLocaleDateString()} by ${selectedRevision.author}`}
                events={selectedEvents}
              />
            </div>
            {sameAsSelected ? (
              <p className="text-xs font-semibold text-[#067647]">This revision already matches the current month.</p>
            ) : (
              <p className="text-xs text-[#667085]">Restoring replaces this month only. Other months and GenAI Program content remain unchanged.</p>
            )}
            {dirty ? <p className="text-xs font-semibold text-[#b54708]">Save or discard your unsaved edits before restoring a revision.</p> : null}
            <button
              type="button"
              disabled={sameAsSelected || dirty || restoring}
              data-testid="button-restore-calendar-revision"
              onClick={() => void restoreSelectedRevision()}
              className="rounded-lg bg-[#b42318] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {restoring ? "Restoring…" : `Restore ${monthLabel} version`}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ComparisonList({ title, events }: { title: string; events: CalendarEvent[] }) {
  return (
    <div className="min-w-0 rounded-md border border-[#eaecf0] bg-white p-3">
      <h4 className="text-xs font-bold text-[#101828]">{title}</h4>
      {events.length === 0 ? (
        <p className="mt-2 text-xs text-[#667085]">No assessments.</p>
      ) : (
        <ul className="mt-2 max-h-48 space-y-2 overflow-auto">
          {events.map((event) => (
            <li key={event.id} className="border-t border-[#f2f4f7] pt-2 text-xs">
              <p className="font-semibold text-[#101828]">{event.date} · {event.label}</p>
              <p className="text-[#667085]">{PROGRAM_NAME[event.program]}{event.mode ? ` · ${MODE_NAME[event.mode]}` : ""}</p>
              {event.link ? <p className="truncate text-[#6941c6]">{event.link}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, testId }: { label: string; value: string; onChange: (v: string) => void; type?: "text" | "date"; placeholder?: string; testId: string }) {
  return (
    <label className="block text-[11px] font-semibold text-[#667085]">
      {label}
      <input type={type} value={value} placeholder={placeholder} data-testid={testId} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-[#d0d5dd] px-2.5 py-1.5 text-sm font-medium text-[#101828]" />
    </label>
  );
}
