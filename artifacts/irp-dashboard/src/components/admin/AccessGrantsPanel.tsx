import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Download,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Timer,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { parseAcademyUserIds } from "@/lib/parseAcademyUserIds";
import { useCountdown } from "@/lib/useCountdown";
import {
  L1_ACCESS_STAGES,
  L1_ACCESS_STAGE_LABELS,
  type L1AccessStage,
} from "@/lib/l1StageAccessMatrix";

const ACCESS_STAGES = L1_ACCESS_STAGES.map((value) => ({
  value,
  label: L1_ACCESS_STAGE_LABELS[value],
}));

type AccessStage = L1AccessStage;

type AccessBatchSummary = {
  id: number;
  name: string | null;
  stage: string;
  linkKind: string;
  url: string;
  enabled: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  scheduled: boolean;
  userCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccessBatchDetail = AccessBatchSummary & {
  academyUserIds: string[];
};

function stageNeedsMockMain(stage: AccessStage): boolean {
  return (
    stage === "online_assessment" ||
    stage === "fe_project" ||
    stage === "ai_mock" ||
    stage === "human_interview"
  );
}

function stageLabel(stage: string): string {
  return L1_ACCESS_STAGE_LABELS[stage as L1AccessStage] ?? stage;
}

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

/** ISO → value for `<input type="datetime-local">` in local timezone. */
function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local → ISO UTC, or null if empty. */
function datetimeLocalToIso(local: string): string | null {
  const v = local.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function downloadCsv(ids: string[], filename: string) {
  const body = ["academy_user_id", ...ids].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

/** Separate start-time cell — shows nothing / "Immediate" / scheduled countdown. */
function StartCell({ startsAt, scheduled }: { startsAt: string | null; scheduled: boolean }) {
  const { timeLeft, isExpired: alreadyStarted } = useCountdown(startsAt);
  const isScheduled = scheduled && !alreadyStarted;

  if (!startsAt) {
    return <span className="text-xs text-[#6e6a8a]">Immediate</span>;
  }

  const dateLabel = new Date(startsAt).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

  if (isScheduled) {
    const ms = new Date(startsAt).getTime() - Date.now();
    const urgency = ms < 30 * 60 * 1000 ? "critical" : ms < 2 * 60 * 60 * 1000 ? "warn" : "scheduled";
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-[#6741d9]">{dateLabel}</span>
        {timeLeft ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
              urgency === "critical"
                ? "bg-red-50 text-red-600"
                : urgency === "warn"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-[#f3f0ff] text-[#6741d9]"
            }`}
          >
            <Timer className="h-3 w-3 shrink-0" />
            in {timeLeft}
          </span>
        ) : null}
      </div>
    );
  }

  // Already started — show the date muted
  return <span className="text-xs text-[#6e6a8a]">{dateLabel}</span>;
}

/** Separate end-time cell — shows countdown to expiry or "No expiry". */
function EndCell({
  expiresAt,
  expired,
  scheduled,
}: {
  expiresAt: string | null;
  expired: boolean;
  scheduled: boolean;
}) {
  const { timeLeft, isExpired: clientExpired } = useCountdown(expiresAt);
  const isNowExpired = expired || clientExpired;

  if (!expiresAt) {
    return <span className="text-xs text-[#6e6a8a]">No expiry</span>;
  }

  const dateLabel = new Date(expiresAt).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

  if (isNowExpired) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-red-600">Expired</span>
        <span className="text-[11px] text-red-400">{dateLabel}</span>
      </div>
    );
  }

  const ms = expiresAt ? new Date(expiresAt).getTime() - Date.now() : Infinity;
  const urgency = ms < 30 * 60 * 1000 ? "critical" : ms < 2 * 60 * 60 * 1000 ? "warn" : "ok";

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-[#6e6a8a]">{dateLabel}</span>
      {!scheduled && timeLeft ? (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
            urgency === "critical"
              ? "bg-red-50 text-red-600"
              : urgency === "warn"
                ? "bg-amber-50 text-amber-700"
                : "bg-[#e8faf0] text-teal"
          }`}
        >
          <Timer className="h-3 w-3 shrink-0" />
          {timeLeft} left
        </span>
      ) : null}
    </div>
  );
}

// ── Step-by-step wizard state ─────────────────────────────────────────────

const WIZARD_STEPS = [
  { id: 1, label: "Grant type", icon: KeyRound },
  { id: 2, label: "Link & timing", icon: CalendarClock },
  { id: 3, label: "Users & review", icon: Users },
] as const;

function WizardSteps({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex items-center gap-0">
      {WIZARD_STEPS.map((s, i) => {
        const done = s.id < current;
        const active = s.id === current;
        const Icon = s.icon;
        return (
          <li key={s.id} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                active
                  ? "bg-[#6741d9] text-white shadow-md"
                  : done
                    ? "bg-[#e8faf0] text-teal"
                    : "bg-slate-100 text-[#6e6a8a]"
              }`}
            >
              {done ? (
                <Check className="h-3 w-3" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              {s.label}
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`mx-1 h-px w-6 ${done ? "bg-teal" : "bg-slate-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function AccessGrantsPanel({ apiKey }: { apiKey: string }) {
  const [batches, setBatches] = useState<AccessBatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AccessBatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Wizard
  const [wizardStep, setWizardStep] = useState(1);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<AccessStage>("online_assessment");
  const [linkKind, setLinkKind] = useState<"mock" | "main" | "default">("mock");
  const [url, setUrl] = useState("");
  const [startsLocal, setStartsLocal] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");
  const [uidsText, setUidsText] = useState("");
  const [csvName, setCsvName] = useState("");

  const parsedIds = useMemo(() => parseAcademyUserIds(uidsText), [uidsText]);

  useEffect(() => {
    if (stageNeedsMockMain(stage)) {
      setLinkKind((prev) => (prev === "default" ? "mock" : prev));
    } else {
      setLinkKind("default");
    }
  }, [stage]);

  function resetWizard() {
    setWizardStep(1);
    setName("");
    setStage("online_assessment");
    setLinkKind("mock");
    setUrl("");
    setStartsLocal("");
    setExpiresLocal("");
    setUidsText("");
    setCsvName("");
  }

  const loadBatches = useCallback(async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/access-batches", {
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to load");
      setBatches((body as { batches?: AccessBatchSummary[] }).batches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load access batches");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  async function loadDetail(id: number) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/access-batches/${id}`, {
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to load batch");
      setDetail((body as { batch: AccessBatchDetail }).batch);
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
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setUidsText(text);
    };
    reader.readAsText(file);
  }

  async function createBatch() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim() || null,
        stage,
        linkKind: stageNeedsMockMain(stage) ? linkKind : "default",
        url: url.trim(),
        startsAt: datetimeLocalToIso(startsLocal),
        expiresAt: datetimeLocalToIso(expiresLocal),
        academyUserIds: parsedIds,
      };
      const res = await fetch("/api/admin/access-batches", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey.trim(),
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to create");
      resetWizard();
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create grant");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(batch: AccessBatchSummary) {
    if (togglingId != null) return;
    setTogglingId(batch.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/access-batches/${batch.id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey.trim(),
        },
        body: JSON.stringify({ enabled: !batch.enabled }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to update");
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update grant");
    } finally {
      setTogglingId(null);
    }
  }

  async function removeBatch(id: number) {
    if (!window.confirm("Delete this access grant? Students will lose this link.")) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/access-batches/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to delete");
      if (expandedId === id) {
        setExpandedId(null);
        setDetail(null);
      }
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete grant");
    }
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    await loadDetail(id);
  }

  // ── preview helpers ─────────────────────────────────────────────────────
  const previewStartsIso = datetimeLocalToIso(startsLocal);
  const previewExpiresIso = datetimeLocalToIso(expiresLocal);

  function fmtDt(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  const step1Valid = true; // stage always has a value
  const step2Valid = url.trim().length > 0;
  const step3Valid = parsedIds.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Create wizard ───────────────────────────────────────────── */}
      <div className="irp-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="mb-1 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#6741d9]" />
            <h2 className="font-display text-lg font-extrabold text-[#0d1117]">
              Create stage access grant
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void loadBatches()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <WizardSteps current={wizardStep} />

        {/* ── Step 1: Grant type ──────────────────────────────────── */}
        {wizardStep === 1 && (
          <div className="space-y-5">
            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
                Stage
              </span>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as AccessStage)}
                className="w-full max-w-sm rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {ACCESS_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            {stageNeedsMockMain(stage) && (
              <fieldset>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
                  Is this a mock or main exam link?
                </legend>
                <div className="flex flex-wrap gap-3">
                  {(["mock", "main"] as const).map((kind) => (
                    <label
                      key={kind}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all ${
                        linkKind === kind
                          ? "border-[#6741d9] bg-[#f3f0ff] text-[#6741d9]"
                          : "border-slate-200 bg-white text-[#6e6a8a] hover:border-[#c4b5fd]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="linkKind"
                        className="hidden"
                        checked={linkKind === kind}
                        onChange={() => setLinkKind(kind)}
                      />
                      <span
                        className={`h-4 w-4 rounded-full border-2 ${
                          linkKind === kind
                            ? "border-[#6741d9] bg-[#6741d9]"
                            : "border-slate-300 bg-white"
                        } flex items-center justify-center`}
                      >
                        {linkKind === kind && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      {kind === "mock" ? "Mock exam link" : "Main exam link"}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
                Batch name (optional)
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "Aug 10 main"'
                className="w-full max-w-sm rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6741d9] px-4 py-2.5 text-sm font-bold text-white"
              >
                Next: Link &amp; timing
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Link & timing ───────────────────────────────── */}
        {wizardStep === 2 && (
          <div className="space-y-5">
            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
                <Link2 className="inline h-3 w-3 mr-1 relative -top-px" />
                Access URL <span className="text-red-500">*</span>
              </span>
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
                  <CalendarClock className="h-3 w-3" />
                  Start time
                </span>
                <input
                  type="datetime-local"
                  value={startsLocal}
                  onChange={(e) => setStartsLocal(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-[#6e6a8a]">
                  {startsLocal
                    ? `Grant hidden until ${fmtDt(previewStartsIso)}`
                    : "Leave empty — active immediately"}
                </p>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
                  <Timer className="h-3 w-3" />
                  End time (expiry)
                </span>
                <input
                  type="datetime-local"
                  value={expiresLocal}
                  onChange={(e) => setExpiresLocal(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-[#6e6a8a]">
                  {expiresLocal
                    ? `Link expires ${fmtDt(previewExpiresIso)}`
                    : "Leave empty — no expiry"}
                </p>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                disabled={!step2Valid}
                onClick={() => setWizardStep(3)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6741d9] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Next: Add users
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Users + review ──────────────────────────────── */}
        {wizardStep === 3 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
                  Academy user IDs
                </span>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">
                  <Upload className="h-3.5 w-3.5" />
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="hidden"
                    onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {csvName ? <span className="text-xs text-[#6e6a8a]">{csvName}</span> : null}
              </div>
              <textarea
                value={uidsText}
                onChange={(e) => setUidsText(e.target.value)}
                rows={6}
                placeholder={"academy_user_id\nuuid-1\nuuid-2\n…"}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
              />
              <p className="text-xs text-[#6e6a8a]">
                {parsedIds.length.toLocaleString()} UID{parsedIds.length === 1 ? "" : "s"} parsed
              </p>
            </div>

            {/* Review card */}
            <div className="rounded-xl border-2 border-[#6741d9]/20 bg-[#faf9ff] p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6741d9]">
                Grant summary — review before saving
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6a8a]">Stage</p>
                  <p className="font-semibold text-[#0d1117]">{stageLabel(stage)}</p>
                </div>
                {stageNeedsMockMain(stage) && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6a8a]">Kind</p>
                    <p className="font-semibold capitalize text-[#0d1117]">{linkKind}</p>
                  </div>
                )}
                {name && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6a8a]">Name</p>
                    <p className="font-semibold text-[#0d1117]">{name}</p>
                  </div>
                )}
                <div className="col-span-full">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6a8a]">URL</p>
                  <p className="break-all font-mono text-xs text-[#6741d9]">{url || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6a8a]">Start time</p>
                  <p className={`font-semibold ${previewStartsIso ? "text-[#0d1117]" : "text-[#6e6a8a]"}`}>
                    {fmtDt(previewStartsIso) ?? "Immediately"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6a8a]">End time</p>
                  <p className={`font-semibold ${previewExpiresIso ? "text-[#0d1117]" : "text-[#6e6a8a]"}`}>
                    {fmtDt(previewExpiresIso) ?? "No expiry"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6a8a]">Users</p>
                  <p className="font-semibold text-[#0d1117]">
                    {parsedIds.length === 0 ? (
                      <span className="text-red-500">None yet</span>
                    ) : (
                      `${parsedIds.length.toLocaleString()} student${parsedIds.length === 1 ? "" : "s"}`
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                disabled={saving || !step2Valid || !step3Valid}
                onClick={() => void createBatch()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6741d9] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save grant
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="irp-card p-5">
        <h2 className="mb-3 font-display text-lg font-extrabold text-[#0d1117]">
          Existing grants
        </h2>
        {loading && batches.length === 0 ? (
          <p className="text-sm text-[#6e6a8a]">Loading…</p>
        ) : batches.length === 0 ? (
          <p className="text-sm text-[#6e6a8a]">No access grants yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(103,65,217,0.12)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Stage</th>
                  <th className="px-2 py-2">Kind</th>
                  <th className="px-2 py-2">URL</th>
                  <th className="px-2 py-2">Start</th>
                  <th className="px-2 py-2">End</th>
                  <th className="px-2 py-2">UIDs</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <Fragment key={b.id}>
                    <tr
                      className={`cursor-pointer border-b border-[rgba(103,65,217,0.06)] hover:bg-[#f8f7ff] ${
                        b.expired ? "opacity-70" : ""
                      }`}
                      onClick={() => void toggleExpand(b.id)}
                    >
                      <td className="px-2 py-2 font-semibold text-[#0d1117]">
                        {b.name || `Batch #${b.id}`}
                      </td>
                      <td className="px-2 py-2">{stageLabel(b.stage)}</td>
                      <td className="px-2 py-2 capitalize">{b.linkKind}</td>
                      <td className="px-2 py-2">
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#6741d9] underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                          title={b.url}
                        >
                          {truncateUrl(b.url)}
                        </a>
                      </td>
                      <td className="px-2 py-2">
                        <StartCell startsAt={b.startsAt ?? null} scheduled={Boolean(b.scheduled)} />
                      </td>
                      <td className="px-2 py-2">
                        <EndCell expiresAt={b.expiresAt ?? null} expired={Boolean(b.expired)} scheduled={Boolean(b.scheduled)} />
                      </td>
                      <td className="px-2 py-2">{b.userCount}</td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={togglingId === b.id}
                          onClick={() => void toggleEnabled(b)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            b.expired
                              ? "bg-amber-50 text-amber-700"
                              : !b.enabled
                                ? "bg-slate-100 text-slate-500"
                                : b.scheduled
                                  ? "bg-[#f3f0ff] text-[#6741d9]"
                                  : "bg-[#e8faf0] text-teal"
                          }`}
                        >
                          {togglingId === b.id
                            ? "…"
                            : b.expired
                              ? "Expired"
                              : !b.enabled
                                ? "Off"
                                : b.scheduled
                                  ? "Scheduled"
                                  : "On"}
                        </button>
                      </td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => void removeBatch(b.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </td>
                    </tr>
                    {expandedId === b.id ? (
                      <tr className="border-b border-[rgba(103,65,217,0.06)] bg-[#faf9ff]">
                        <td colSpan={8} className="px-3 py-3">
                          {detailLoading ? (
                            <p className="text-xs text-[#6e6a8a]">Loading UIDs…</p>
                          ) : detail?.id === b.id ? (
                            <div className="space-y-3">
                              <TimingEditor
                                apiKey={apiKey}
                                batchId={b.id}
                                initialStartsIso={b.startsAt ?? null}
                                initialExpiresIso={b.expiresAt ?? null}
                                onSaved={() => void loadBatches()}
                                onError={setError}
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-[#6e6a8a]">
                                  {detail.academyUserIds.length} academy user id
                                  {detail.academyUserIds.length === 1 ? "" : "s"}
                                </span>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                                  onClick={() =>
                                    downloadCsv(
                                      detail.academyUserIds,
                                      `access-batch-${b.id}.csv`,
                                    )
                                  }
                                >
                                  <Download className="h-3 w-3" />
                                  Download CSV
                                </button>
                              </div>
                              <pre className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700">
                                {detail.academyUserIds.join("\n")}
                              </pre>
                            </div>
                          ) : (
                            <p className="text-xs text-[#6e6a8a]">Could not load detail.</p>
                          )}
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

function TimingEditor({
  apiKey,
  batchId,
  initialStartsIso,
  initialExpiresIso,
  onSaved,
  onError,
}: {
  apiKey: string;
  batchId: number;
  initialStartsIso: string | null;
  initialExpiresIso: string | null;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [startsLocal, setStartsLocal] = useState(() => isoToDatetimeLocal(initialStartsIso));
  const [expiresLocal, setExpiresLocal] = useState(() => isoToDatetimeLocal(initialExpiresIso));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStartsLocal(isoToDatetimeLocal(initialStartsIso));
    setExpiresLocal(isoToDatetimeLocal(initialExpiresIso));
  }, [initialStartsIso, initialExpiresIso, batchId]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/access-batches/${batchId}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey.trim(),
        },
        body: JSON.stringify({
          startsAt: datetimeLocalToIso(startsLocal),
          expiresAt: datetimeLocalToIso(expiresLocal),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to update timing");
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update timing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <label className="text-sm">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#6e6a8a]">
          Available from
        </span>
        <input
          type="datetime-local"
          value={startsLocal}
          onChange={(e) => setStartsLocal(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#6e6a8a]">
          Expires at
        </span>
        <input
          type="datetime-local"
          value={expiresLocal}
          onChange={(e) => setExpiresLocal(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-[#6741d9] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save timing"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setStartsLocal("");
            setExpiresLocal("");
            void (async () => {
              setSaving(true);
              try {
                const res = await fetch(`/api/admin/access-batches/${batchId}`, {
                  method: "PUT",
                  headers: {
                    "content-type": "application/json",
                    "x-api-key": apiKey.trim(),
                  },
                  body: JSON.stringify({ startsAt: null, expiresAt: null }),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed");
                onSaved();
              } catch (err) {
                onError(err instanceof Error ? err.message : "Could not clear timing");
              } finally {
                setSaving(false);
              }
            })();
          }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
        >
          Clear both
        </button>
      </div>
    </div>
  );
}
