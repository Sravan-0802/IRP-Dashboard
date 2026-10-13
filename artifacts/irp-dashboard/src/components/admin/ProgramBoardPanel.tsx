import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  DEFAULT_PROGRAM_BOARD,
  type CalendarEvent,
  type CalendarUpcoming,
  type GenAiAssessment,
  type ProgramBoard,
} from "@/lib/programBoard";

type EditorTab = "genai" | "calendar";

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ProgramBoardPanel({ apiKey }: { apiKey: string }) {
  const [tab, setTab] = useState<EditorTab>("genai");
  const [draft, setDraft] = useState<ProgramBoard>(DEFAULT_PROGRAM_BOARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/program-board", { headers: { "x-api-key": apiKey.trim() } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to load");
      setDraft(body as ProgramBoard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load program content");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!apiKey.trim() || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/program-board", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-api-key": apiKey.trim() },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to save");
      setDraft(body as ProgramBoard);
      setMessage("Saved. Students see this on GenAI Program and Assessment Calendar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function patchGenAi<K extends keyof ProgramBoard["genai"]>(key: K, value: ProgramBoard["genai"][K]) {
    setDraft((prev) => ({ ...prev, genai: { ...prev.genai, [key]: value } }));
  }

  return (
    <div className="irp-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#6741d9]" />
            <h2 className="font-display text-lg font-extrabold text-[#0d1117]">GenAI Program and calendar</h2>
          </div>
          <p className="max-w-2xl text-sm text-[#6e6a8a]">
            Add, edit, or remove what students see. Save stores it for every student.
            {draft.updatedAt ? ` Last saved ${new Date(draft.updatedAt).toLocaleString()}.` : " Nothing saved yet — students still see the sample."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(103,65,217,0.2)] px-3 py-1.5 text-xs font-semibold text-[#6941c6] disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button type="button" onClick={() => void save()} disabled={loading || saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[#6941c6] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>

      <div className="inline-flex rounded-full bg-[#f2f4f7] p-1">
        <TabButton active={tab === "genai"} onClick={() => setTab("genai")}>GenAI Program</TabButton>
        <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")}>Assessment Calendar</TabButton>
      </div>

      {error ? <p className="text-sm font-semibold text-[#b42318]">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-[#067647]">{message}</p> : null}

      {loading ? (
        <p className="py-8 text-sm text-[#6e6a8a]">Loading…</p>
      ) : tab === "genai" ? (
        <GenAiEditor draft={draft.genai} onChange={patchGenAi} />
      ) : (
        <CalendarEditor
          events={draft.calendar.events}
          upcoming={draft.calendar.upcoming}
          onEvents={(events) => setDraft((prev) => ({ ...prev, calendar: { ...prev.calendar, events } }))}
          onUpcoming={(upcoming) => setDraft((prev) => ({ ...prev, calendar: { ...prev.calendar, upcoming } }))}
        />
      )}
    </div>
  );
}

function GenAiEditor({
  draft,
  onChange,
}: {
  draft: ProgramBoard["genai"];
  onChange: <K extends keyof ProgramBoard["genai"]>(key: K, value: ProgramBoard["genai"][K]) => void;
}) {
  return (
    <div className="space-y-5">
      <ListBlock
        title="Assessments"
        onAdd={() =>
          onChange("assessments", [
            ...draft.assessments,
            {
              id: newId("assessment"),
              label: "ASSESSMENT",
              title: "New assessment",
              when: "",
              score: "",
              note: "",
              noteTone: "warn",
              status: "open",
              actionLabel: "Register",
            },
          ])
        }
      >
        <p className="text-xs text-[#667085]">
          Edit a row or delete it, then press Save. Registration open shows the banner. Completed shows under Your scores.
        </p>
        {draft.assessments.map((item, index) => (
          <Row key={item.id}>
            <Field label="Title" value={item.title} onChange={(value) => onChange("assessments", replaceAt(draft.assessments, index, { ...item, title: value }))} />
            <Field label="When" value={item.when} onChange={(value) => onChange("assessments", replaceAt(draft.assessments, index, { ...item, when: value }))} />
            <Field label="Score" value={item.score} onChange={(value) => onChange("assessments", replaceAt(draft.assessments, index, { ...item, score: value }))} />
            <Field label="Note" value={item.note} onChange={(value) => onChange("assessments", replaceAt(draft.assessments, index, { ...item, note: value, noteTone: value ? "warn" : "default" }))} />
            <SelectField
              label="Status"
              value={item.status}
              options={[
                ["open", "Registration open"],
                ["completed", "Completed"],
                ["upcoming", "Upcoming"],
              ]}
              onChange={(value) => onChange("assessments", replaceAt(draft.assessments, index, { ...item, status: value as GenAiAssessment["status"] }))}
            />
            <Remove label="Delete" onClick={() => onChange("assessments", draft.assessments.filter((row) => row.id !== item.id))} />
          </Row>
        ))}
      </ListBlock>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#101828]">Next live class</h3>
          <p className="text-xs text-[#667085]">Students see this card only after you add a class title and Save.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Live badge" value={draft.liveBadge} onChange={(value) => onChange("liveBadge", value)} />
          <Field label="Week pill" value={draft.weekOf} onChange={(value) => onChange("weekOf", value)} />
          <Field label="Week and session" value={draft.weekLabel} onChange={(value) => onChange("weekLabel", value)} />
          <Field label="Class title" value={draft.classTitle} onChange={(value) => onChange("classTitle", value)} />
          <Field label="Start hour (0–23 IST)" value={String(draft.classHour)} onChange={(value) => onChange("classHour", Number(value) || 0)} />
          <Field label="Start minute" value={String(draft.classMinute)} onChange={(value) => onChange("classMinute", Number(value) || 0)} />
          <Field label="Join class URL" value={draft.liveUrl} onChange={(value) => onChange("liveUrl", value)} />
        </div>
      </section>

      <ListBlock
        title="Live classes"
        onAdd={() =>
          onChange("classes", [
            ...draft.classes,
            { day: "MON", date: "01", title: "Live class title", time: "7:00 PM IST", duration: "90 min", instructor: "Instructor", action: "Join opens 6:45 PM", live: false, link: "/" },
          ])
        }
      >
        <p className="text-xs text-[#667085]">Add a class or edit a row. Link `/` opens the dashboard. A full https link opens that page.</p>
        {draft.classes.map((item, index) => (
          <Row key={`${item.day}-${item.date}-${index}`}>
            <Field label="Day" value={item.day} onChange={(value) => onChange("classes", replaceAt(draft.classes, index, { ...item, day: value }))} />
            <Field label="Date" value={item.date} onChange={(value) => onChange("classes", replaceAt(draft.classes, index, { ...item, date: value }))} />
            <Field label="Title" value={item.title} onChange={(value) => onChange("classes", replaceAt(draft.classes, index, { ...item, title: value }))} />
            <Field label="Time" value={item.time} onChange={(value) => onChange("classes", replaceAt(draft.classes, index, { ...item, time: value }))} />
            <Field label="Duration" value={item.duration} onChange={(value) => onChange("classes", replaceAt(draft.classes, index, { ...item, duration: value }))} />
            <Field label="Instructor" value={item.instructor} onChange={(value) => onChange("classes", replaceAt(draft.classes, index, { ...item, instructor: value }))} />
            <Field label="Link" value={item.link ?? "/"} onChange={(value) => onChange("classes", replaceAt(draft.classes, index, { ...item, link: value }))} />
            <Field label="Right-side note" value={item.action} onChange={(value) => onChange("classes", replaceAt(draft.classes, index, { ...item, action: value }))} />
            <label className="flex items-center gap-2 text-xs font-semibold text-[#344054]">
              <input
                type="checkbox"
                checked={item.live}
                onChange={(event) => onChange("classes", replaceAt(draft.classes, index, { ...item, live: event.target.checked }))}
              />
              Show countdown
            </label>
            <Remove onClick={() => onChange("classes", draft.classes.filter((_, i) => i !== index))} />
          </Row>
        ))}
      </ListBlock>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#101828]">Learning portal button</h3>
          <p className="text-xs text-[#667085]">Students use this button under the class list.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Button label" value={draft.portalLabel} onChange={(value) => onChange("portalLabel", value)} />
          <Field label="Button link" value={draft.portalUrl ?? "https://learning.ccbp.in/course-live-classes"} onChange={(value) => onChange("portalUrl", value)} />
        </div>
      </section>
    </div>
  );
}

function CalendarEditor({
  events,
  upcoming,
  onEvents,
  onUpcoming,
}: {
  events: CalendarEvent[];
  upcoming: CalendarUpcoming[];
  onEvents: (events: CalendarEvent[]) => void;
  onUpcoming: (upcoming: CalendarUpcoming[]) => void;
}) {
  return (
    <div className="space-y-5">
      <ListBlock
        title="Calendar chips"
        onAdd={() => onEvents([...events, { id: newId("event"), date: "2026-10-01", program: "genai", label: "New event" }])}
      >
        {events.map((event, index) => (
          <Row key={event.id}>
            <Field label="Date" value={event.date} onChange={(value) => onEvents(replaceAt(events, index, { ...event, date: value }))} />
            <SelectField
              label="Program"
              value={event.program}
              options={[["genai", "GenAI"], ["irp", "IRP"]]}
              onChange={(value) => onEvents(replaceAt(events, index, { ...event, program: value as CalendarEvent["program"] }))}
            />
            <Field label="Label" value={event.label} onChange={(value) => onEvents(replaceAt(events, index, { ...event, label: value }))} />
            <Remove onClick={() => onEvents(events.filter((row) => row.id !== event.id))} />
          </Row>
        ))}
      </ListBlock>

      <ListBlock
        title="Coming up"
        onAdd={() =>
          onUpcoming([
            ...upcoming,
            { id: newId("upcoming"), program: "genai", when: "", title: "New item", detail: "", action: "", badge: "upcoming" },
          ])
        }
      >
        {upcoming.map((item, index) => (
          <Row key={item.id}>
            <SelectField
              label="Program"
              value={item.program}
              options={[["genai", "GenAI"], ["irp", "IRP"]]}
              onChange={(value) => onUpcoming(replaceAt(upcoming, index, { ...item, program: value as CalendarUpcoming["program"] }))}
            />
            <Field label="When" value={item.when} onChange={(value) => onUpcoming(replaceAt(upcoming, index, { ...item, when: value }))} />
            <Field label="Title" value={item.title} onChange={(value) => onUpcoming(replaceAt(upcoming, index, { ...item, title: value }))} />
            <Field label="Detail" value={item.detail} onChange={(value) => onUpcoming(replaceAt(upcoming, index, { ...item, detail: value }))} />
            <SelectField
              label="Button"
              value={item.action}
              options={[["", "None"], ["register", "Register"], ["submit", "Submit"]]}
              onChange={(value) => onUpcoming(replaceAt(upcoming, index, { ...item, action: value as CalendarUpcoming["action"] }))}
            />
            <SelectField
              label="Badge"
              value={item.badge}
              options={[["", "None"], ["not-registered", "Not registered"], ["upcoming", "Upcoming"], ["locked", "Locked"]]}
              onChange={(value) => onUpcoming(replaceAt(upcoming, index, { ...item, badge: value as CalendarUpcoming["badge"] }))}
            />
            <Remove onClick={() => onUpcoming(upcoming.filter((row) => row.id !== item.id))} />
          </Row>
        ))}
      </ListBlock>
    </div>
  );
}

function replaceAt<T>(list: T[], index: number, next: T): T[] {
  return list.map((item, i) => (i === index ? next : item));
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#101828] shadow-sm" : "rounded-full px-3 py-1.5 text-xs font-semibold text-[#667085]"}
    >
      {children}
    </button>
  );
}

function ListBlock({ title, onAdd, children }: { title: string; onAdd: () => void; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-[#101828]">{title}</h3>
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg border border-[#d0d5dd] px-2.5 py-1 text-xs font-semibold text-[#344054]">
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid items-end gap-2 rounded-xl border border-[#eaecf0] p-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[11px] font-semibold text-[#667085]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-[#d0d5dd] px-2.5 py-1.5 text-sm font-medium text-[#101828]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold text-[#667085]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-[#d0d5dd] bg-white px-2.5 py-1.5 text-sm font-medium text-[#101828]"
      >
        {options.map(([id, name]) => (
          <option key={id || "none"} value={id}>{name}</option>
        ))}
      </select>
    </label>
  );
}

function Remove({ onClick, label = "Remove" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-9 items-center gap-1 text-xs font-semibold text-[#b42318]">
      <Trash2 className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
