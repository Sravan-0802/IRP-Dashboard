import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw, Timer, Trash2, Upload, ClipboardList, CheckCircle2 } from "lucide-react";
import { parseAcademyUserIds } from "@/lib/parseAcademyUserIds";
import { useCountdown } from "@/lib/useCountdown";

type RegistrationBatchSummary = {
  id: number;
  name: string | null;
  assessmentLabel: string;
  assessmentDate: string;
  slotId: string | null;
  slotLabel: string | null;
  enabled: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  scheduled: boolean;
  userCount: number;
  responseCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type RegistrationBatchDetail = RegistrationBatchSummary & {
  academyUserIds: string[];
};

type BatchRegistrationResponse = {
  id: number;
  academyUserId: string;
  userName: string | null;
  batchId: number;
  batchName: string | null;
  assessmentLabel: string;
  availability: string;
  slotId: string | null;
  slotLabel: string | null;
  understandsGc: boolean | null;
  willAttend: boolean | null;
  unavailabilityReason: string | null;
  notifyNextCycle: boolean | null;
  submittedAt: string;
};

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local: string): string | null {
  const v = local.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function availLabel(a: string): string {
  if (a === "yes") return "✅ Available";
  if (a === "no-not-prepared") return "❌ Not prepared";
  if (a === "no-conflict") return "❌ Has conflict";
  return a;
}

function downloadCsv(rows: BatchRegistrationResponse[], filename: string) {
  const header = ["batch_id","batch_name","academy_user_id","user_name","availability","slot_id","slot_label","understands_gc","will_attend","unavailability_reason","notify_next_cycle","submitted_at"];
  const lines = rows.map((r) => [
    r.batchId, r.batchName ?? "", r.academyUserId, r.userName ?? "",
    r.availability, r.slotId ?? "", r.slotLabel ?? "",
    r.understandsGc == null ? "" : r.understandsGc ? "yes" : "no",
    r.willAttend == null ? "" : r.willAttend ? "yes" : "no",
    (r.unavailabilityReason ?? "").replace(/,/g, ";"),
    r.notifyNextCycle == null ? "" : r.notifyNextCycle ? "yes" : "no",
    r.submittedAt,
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const body = [header.join(","), ...lines].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

function downloadUidsCsv(ids: string[], filename: string) {
  const body = ["academy_user_id", ...ids].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

function WindowCell({ startsAt, expiresAt, expired, scheduled }: {
  startsAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  scheduled: boolean;
}) {
  const target = scheduled ? startsAt : expiresAt;
  const { timeLeft, isExpired: clientExpired } = useCountdown(target);
  const isNowExpired = !scheduled && (expired || clientExpired);
  const isNowScheduled = scheduled && !clientExpired;

  if (isNowScheduled && startsAt) {
    const dateStr = new Date(startsAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-[#6741d9]">From {dateStr}</span>
        {timeLeft ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#f3f0ff] px-1.5 py-0.5 text-[11px] font-bold text-[#6741d9]">
            <Timer className="h-3 w-3" />Starts in {timeLeft}
          </span>
        ) : null}
      </div>
    );
  }
  if (!expiresAt) return <span className="text-xs text-[#6e6a8a]">No expiry</span>;
  const dateStr = new Date(expiresAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-xs font-semibold ${isNowExpired ? "text-red-600" : "text-[#6e6a8a]"}`}>
        {isNowExpired ? "Expired" : `Until ${dateStr}`}
      </span>
      {!isNowExpired && timeLeft ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#e8faf0] px-1.5 py-0.5 text-[11px] font-bold text-teal">
          <Timer className="h-3 w-3" />{timeLeft} left
        </span>
      ) : null}
    </div>
  );
}

export function RegistrationBatchesPanel({ apiKey }: { apiKey: string }) {
  const [batches, setBatches] = useState<RegistrationBatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RegistrationBatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [assessmentLabel, setAssessmentLabel] = useState("");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [slotLabel, setSlotLabel] = useState("");
  const [startsLocal, setStartsLocal] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");
  const [uidsText, setUidsText] = useState("");
  const [csvName, setCsvName] = useState("");

  const parsedIds = useMemo(() => parseAcademyUserIds(uidsText), [uidsText]);

  const loadBatches = useCallback(async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/registration-batches", {
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({})) as { batches?: RegistrationBatchSummary[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load");
      setBatches(body.batches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load registration batches");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => { void loadBatches(); }, [loadBatches]);

  async function loadDetail(id: number) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/registration-batches/${id}`, {
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({})) as { batch?: RegistrationBatchDetail; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load");
      setDetail(body.batch ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load batch detail");
    } finally {
      setDetailLoading(false);
    }
  }

  function onCsvFile(file: File | null) {
    if (!file) return;
    setCsvName(file.name);
    const reader = new FileReader();
    reader.onload = () => { setUidsText(typeof reader.result === "string" ? reader.result : ""); };
    reader.readAsText(file);
  }

  async function createBatch() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/registration-batches", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey.trim() },
        body: JSON.stringify({
          name: name.trim() || null,
          assessmentLabel: assessmentLabel.trim(),
          assessmentDate: assessmentDate.trim(),
          slotId: slotId.trim() || null,
          slotLabel: slotLabel.trim() || null,
          startsAt: datetimeLocalToIso(startsLocal),
          expiresAt: datetimeLocalToIso(expiresLocal),
          academyUserIds: parsedIds,
        }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to create");
      setName(""); setAssessmentLabel(""); setAssessmentDate("");
      setSlotId(""); setSlotLabel("");
      setStartsLocal(""); setExpiresLocal("");
      setUidsText(""); setCsvName("");
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create batch");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(b: RegistrationBatchSummary) {
    if (togglingId != null) return;
    setTogglingId(b.id);
    try {
      const res = await fetch(`/api/admin/registration-batches/${b.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-api-key": apiKey.trim() },
        body: JSON.stringify({ enabled: !b.enabled }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to update");
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update batch");
    } finally {
      setTogglingId(null);
    }
  }

  async function removeBatch(id: number) {
    if (!window.confirm("Delete this registration batch? Students will no longer see the callout.")) return;
    try {
      const res = await fetch(`/api/admin/registration-batches/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to delete");
      if (expandedId === id) { setExpandedId(null); setDetail(null); }
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete batch");
    }
  }

  async function downloadResponses(id: number, batchName: string | null) {
    try {
      const res = await fetch(`/api/admin/registration-batches/${id}/responses`, {
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({})) as { responses?: BatchRegistrationResponse[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed");
      downloadCsv(body.responses ?? [], `reg-batch-${id}-${batchName ?? "responses"}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download responses");
    }
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    await loadDetail(id);
  }

  return (
    <div className="space-y-6">
      <div className="irp-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#6741d9]" />
              <h2 className="font-display text-lg font-extrabold text-[#0d1117]">Create registration batch</h2>
            </div>
            <p className="max-w-2xl text-sm text-[#6e6a8a]">
              Target specific students for a registration window. They'll see a "Register for assessment" callout on their dashboard.
            </p>
          </div>
          <button type="button" onClick={() => void loadBatches()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>

        {error ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">Batch name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Aug 10 main cohort"'
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">Assessment label <span className="text-red-500">*</span></span>
            <input value={assessmentLabel} onChange={(e) => setAssessmentLabel(e.target.value)}
              placeholder='e.g. "L1 Hustler — Aug 10 2026"'
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">Assessment date <span className="text-red-500">*</span></span>
            <input value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)}
              placeholder='e.g. "10th Aug 2026"'
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">Slot ID</span>
              <input value={slotId} onChange={(e) => setSlotId(e.target.value)}
                placeholder="slot-4"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">Slot label</span>
              <input value={slotLabel} onChange={(e) => setSlotLabel(e.target.value)}
                placeholder="6:00 PM – 8:00 PM IST"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">Registration opens (optional)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input type="datetime-local" value={startsLocal} onChange={(e) => setStartsLocal(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              {startsLocal ? (
                <button type="button" onClick={() => setStartsLocal("")}
                  className="text-xs font-bold text-[#6e6a8a] underline">Clear</button>
              ) : <span className="text-xs text-[#6e6a8a]">Empty = open immediately</span>}
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">Registration closes (optional)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input type="datetime-local" value={expiresLocal} onChange={(e) => setExpiresLocal(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              {expiresLocal ? (
                <button type="button" onClick={() => setExpiresLocal("")}
                  className="text-xs font-bold text-[#6e6a8a] underline">Clear</button>
              ) : <span className="text-xs text-[#6e6a8a]">Empty = no close date</span>}
            </div>
          </label>

          <div className="md:col-span-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                <Upload className="h-3.5 w-3.5" />Upload CSV
                <input type="file" accept=".csv,text/csv,text/plain" className="hidden"
                  onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)} />
              </label>
              {csvName ? <span className="text-xs text-[#6e6a8a]">{csvName}</span> : null}
              <span className="text-xs text-[#6e6a8a]">
                {parsedIds.length.toLocaleString()} UID{parsedIds.length === 1 ? "" : "s"} parsed
              </span>
            </div>
            <textarea value={uidsText} onChange={(e) => setUidsText(e.target.value)} rows={5}
              placeholder={"academy_user_id\nuuid-1\nuuid-2\n…"}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" />
          </div>
        </div>

        <div className="mt-4">
          <button type="button"
            disabled={saving || !assessmentLabel.trim() || !assessmentDate.trim() || parsedIds.length === 0}
            onClick={() => void createBatch()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6741d9] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save batch
          </button>
        </div>
      </div>

      <div className="irp-card p-5">
        <h2 className="mb-3 font-display text-lg font-extrabold text-[#0d1117]">Existing batches</h2>
        {loading && batches.length === 0 ? (
          <p className="text-sm text-[#6e6a8a]">Loading…</p>
        ) : batches.length === 0 ? (
          <p className="text-sm text-[#6e6a8a]">No registration batches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(103,65,217,0.12)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                  <th className="px-2 py-2">Name / Assessment</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Slot</th>
                  <th className="px-2 py-2">Window</th>
                  <th className="px-2 py-2">UIDs</th>
                  <th className="px-2 py-2">Responses</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <Fragment key={b.id}>
                    <tr className={`cursor-pointer border-b border-[rgba(103,65,217,0.06)] hover:bg-[#f8f7ff] ${b.expired ? "opacity-70" : ""}`}
                      onClick={() => void toggleExpand(b.id)}>
                      <td className="px-2 py-2">
                        <p className="font-semibold text-[#0d1117]">{b.name || `Batch #${b.id}`}</p>
                        <p className="text-xs text-[#6e6a8a]">{b.assessmentLabel}</p>
                      </td>
                      <td className="px-2 py-2 text-xs text-[#0d1117]">{b.assessmentDate}</td>
                      <td className="px-2 py-2 text-xs text-[#6e6a8a]">{b.slotLabel ?? "—"}</td>
                      <td className="px-2 py-2">
                        <WindowCell startsAt={b.startsAt} expiresAt={b.expiresAt}
                          expired={b.expired} scheduled={b.scheduled} />
                      </td>
                      <td className="px-2 py-2">{b.userCount}</td>
                      <td className="px-2 py-2">
                        <span className={`font-semibold ${b.responseCount > 0 ? "text-[#0ca678]" : "text-[#6e6a8a]"}`}>
                          {b.responseCount}
                        </span>
                      </td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <button type="button" disabled={togglingId === b.id}
                          onClick={() => void toggleEnabled(b)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            b.expired ? "bg-amber-50 text-amber-700"
                            : !b.enabled ? "bg-slate-100 text-slate-500"
                            : b.scheduled ? "bg-[#f3f0ff] text-[#6741d9]"
                            : "bg-[#e8faf0] text-teal"}`}>
                          {togglingId === b.id ? "…" : b.expired ? "Expired" : !b.enabled ? "Off" : b.scheduled ? "Scheduled" : "On"}
                        </button>
                      </td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          <button type="button"
                            onClick={() => void downloadResponses(b.id, b.name)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[rgba(103,65,217,0.25)] px-2 py-1 text-xs font-bold text-[#6741d9]">
                            <Download className="h-3 w-3" />CSV
                          </button>
                          <button type="button"
                            onClick={() => void removeBatch(b.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-600">
                            <Trash2 className="h-3 w-3" />Del
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === b.id ? (
                      <tr className="border-b border-[rgba(103,65,217,0.06)] bg-[#faf9ff]">
                        <td colSpan={8} className="px-3 py-3">
                          {detailLoading ? (
                            <p className="text-xs text-[#6e6a8a]">Loading UIDs…</p>
                          ) : detail?.id === b.id ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-[#6e6a8a]">
                                  {detail.academyUserIds.length} UIDs
                                </span>
                                <button type="button"
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                                  onClick={() => downloadUidsCsv(detail.academyUserIds, `reg-batch-${b.id}-uids.csv`)}>
                                  <Download className="h-3 w-3" />Download UIDs CSV
                                </button>
                              </div>
                              <pre className="max-h-32 overflow-auto rounded-lg border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700">
                                {detail.academyUserIds.join("\n")}
                              </pre>
                            </div>
                          ) : <p className="text-xs text-[#6e6a8a]">Could not load detail.</p>}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function RegistrationResponsesPanel({ apiKey }: { apiKey: string }) {
  const [responses, setResponses] = useState<BatchRegistrationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadResponses = useCallback(async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/registration-batches/responses", {
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({})) as { responses?: BatchRegistrationResponse[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setResponses(body.responses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load responses");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => { void loadResponses(); }, [loadResponses]);

  const availCount = responses.filter((r) => r.availability === "yes").length;
  const unavailCount = responses.filter((r) => r.availability !== "yes").length;

  return (
    <div className="space-y-4">
      <div className="irp-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#6741d9]" />
            <h2 className="font-display text-lg font-extrabold text-[#0d1117]">
              Registration responses
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {responses.length > 0 ? (
              <>
                <span className="text-xs font-semibold text-[#6e6a8a]">
                  {responses.length} total · ✅ {availCount} available · ❌ {unavailCount} unavailable
                </span>
                <button type="button"
                  onClick={() => downloadCsv(responses, "registration-responses.csv")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                  <Download className="h-3.5 w-3.5" />Download CSV
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => void loadResponses()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
            </button>
          </div>
        </div>

        {error ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {loading && responses.length === 0 ? (
          <p className="text-sm text-[#6e6a8a]">Loading…</p>
        ) : responses.length === 0 ? (
          <p className="text-sm text-[#6e6a8a]">No responses yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(103,65,217,0.12)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                  <th className="px-2 py-2">Student</th>
                  <th className="px-2 py-2">UID</th>
                  <th className="px-2 py-2">Batch</th>
                  <th className="px-2 py-2">Availability</th>
                  <th className="px-2 py-2">Slot</th>
                  <th className="px-2 py-2">GC ✓</th>
                  <th className="px-2 py-2">Attend ✓</th>
                  <th className="px-2 py-2">Reason</th>
                  <th className="px-2 py-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id} className="border-b border-[rgba(103,65,217,0.06)] hover:bg-[#f8f7ff]">
                    <td className="px-2 py-2 font-semibold text-[#0d1117]">{r.userName || "—"}</td>
                    <td className="px-2 py-2 font-mono text-[11px] text-[#6e6a8a]">
                      {r.academyUserId.slice(0, 8)}…
                    </td>
                    <td className="px-2 py-2 text-xs text-[#0d1117]">
                      {r.batchName || `#${r.batchId}`}
                    </td>
                    <td className="px-2 py-2 text-xs font-semibold">
                      <span className={r.availability === "yes" ? "text-[#0ca678]" : "text-[#e67700]"}>
                        {availLabel(r.availability)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-[#6e6a8a]">{r.slotLabel ?? "—"}</td>
                    <td className="px-2 py-2 text-center text-xs">
                      {r.understandsGc === true ? "✅" : r.understandsGc === false ? "❌" : "—"}
                    </td>
                    <td className="px-2 py-2 text-center text-xs">
                      {r.willAttend === true ? "✅" : r.willAttend === false ? "❌" : "—"}
                    </td>
                    <td className="max-w-[160px] truncate px-2 py-2 text-xs text-[#6e6a8a]"
                      title={r.unavailabilityReason ?? ""}>
                      {r.unavailabilityReason ? r.unavailabilityReason.slice(0, 40) + (r.unavailabilityReason.length > 40 ? "…" : "") : "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-[#6e6a8a]">
                      {new Date(r.submittedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
