import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  KeyRound,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { parseAcademyUserIds } from "@/lib/parseAcademyUserIds";
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
  expiresAt: string | null;
  expired: boolean;
  userCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccessBatchDetail = AccessBatchSummary & {
  academyUserIds: string[];
};

function stageNeedsMockMain(stage: AccessStage): boolean {
  return stage === "online_assessment" || stage === "fe_project";
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

function formatExpires(iso: string | null, expired: boolean): string {
  if (!iso) return "No expiry";
  const label = new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return expired ? `Expired ${label}` : `Until ${label}`;
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

export function AccessGrantsPanel({ apiKey }: { apiKey: string }) {
  const [batches, setBatches] = useState<AccessBatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AccessBatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [name, setName] = useState("");
  const [stage, setStage] = useState<AccessStage>("online_assessment");
  const [linkKind, setLinkKind] = useState<"mock" | "main" | "default">("mock");
  const [url, setUrl] = useState("");
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
      setName("");
      setUrl("");
      setExpiresLocal("");
      setUidsText("");
      setCsvName("");
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

  return (
    <div className="space-y-6">
      <div className="irp-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#6741d9]" />
              <h2 className="font-display text-lg font-extrabold text-[#0d1117]">
                Create stage access grant
              </h2>
            </div>
            <p className="max-w-2xl text-sm text-[#6e6a8a]">
              Upload academy UIDs, pick a stage (and mock/main when needed), paste the access URL,
              and optionally set a link expiry. After expiry the student UI hides that grant automatically.
            </p>
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

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
              Optional name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "July 26 mock"'
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
              Stage
            </span>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as AccessStage)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              {ACCESS_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {stageNeedsMockMain(stage) ? (
            <fieldset className="md:col-span-2">
              <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
                Link kind
              </legend>
              <div className="flex flex-wrap gap-4">
                {(["mock", "main"] as const).map((kind) => (
                  <label key={kind} className="inline-flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="radio"
                      name="linkKind"
                      checked={linkKind === kind}
                      onChange={() => setLinkKind(kind)}
                    />
                    {kind === "mock" ? "Mock" : "Main"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
              Access URL
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
              Link expires at (optional)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={expiresLocal}
                onChange={(e) => setExpiresLocal(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              {expiresLocal ? (
                <button
                  type="button"
                  onClick={() => setExpiresLocal("")}
                  className="text-xs font-bold text-[#6e6a8a] underline"
                >
                  Clear (no expiry)
                </button>
              ) : (
                <span className="text-xs text-[#6e6a8a]">Leave empty for no expiry</span>
              )}
            </div>
          </label>

          <div className="md:col-span-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
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
              <span className="text-xs text-[#6e6a8a]">
                {parsedIds.length.toLocaleString()} UID{parsedIds.length === 1 ? "" : "s"} parsed
              </span>
            </div>
            <textarea
              value={uidsText}
              onChange={(e) => setUidsText(e.target.value)}
              rows={6}
              placeholder={"academy_user_id\nuuid-1\nuuid-2\n…"}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            disabled={saving || !url.trim() || parsedIds.length === 0}
            onClick={() => void createBatch()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6741d9] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save grant
          </button>
        </div>
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
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(103,65,217,0.12)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Stage</th>
                  <th className="px-2 py-2">Kind</th>
                  <th className="px-2 py-2">URL</th>
                  <th className="px-2 py-2">Expires</th>
                  <th className="px-2 py-2">UIDs</th>
                  <th className="px-2 py-2">Enabled</th>
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
                        <span
                          className={`text-xs font-semibold ${
                            b.expired ? "text-red-600" : "text-[#6e6a8a]"
                          }`}
                        >
                          {formatExpires(b.expiresAt ?? null, Boolean(b.expired))}
                        </span>
                      </td>
                      <td className="px-2 py-2">{b.userCount}</td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={togglingId === b.id}
                          onClick={() => void toggleEnabled(b)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            b.enabled && !b.expired
                              ? "bg-[#e8faf0] text-teal"
                              : b.enabled && b.expired
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {togglingId === b.id
                            ? "…"
                            : b.expired
                              ? "Expired"
                              : b.enabled
                                ? "On"
                                : "Off"}
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
                              <ExpiryEditor
                                apiKey={apiKey}
                                batchId={b.id}
                                initialIso={b.expiresAt ?? null}
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

function ExpiryEditor({
  apiKey,
  batchId,
  initialIso,
  onSaved,
  onError,
}: {
  apiKey: string;
  batchId: number;
  initialIso: string | null;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [local, setLocal] = useState(() => isoToDatetimeLocal(initialIso));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(isoToDatetimeLocal(initialIso));
  }, [initialIso, batchId]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/access-batches/${batchId}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey.trim(),
        },
        body: JSON.stringify({ expiresAt: datetimeLocalToIso(local) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to update expiry");
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update expiry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <label className="text-sm">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#6e6a8a]">
          Update expiry
        </span>
        <input
          type="datetime-local"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-lg bg-[#6741d9] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save expiry"}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => {
          setLocal("");
          void (async () => {
            setSaving(true);
            try {
              const res = await fetch(`/api/admin/access-batches/${batchId}`, {
                method: "PUT",
                headers: {
                  "content-type": "application/json",
                  "x-api-key": apiKey.trim(),
                },
                body: JSON.stringify({ expiresAt: null }),
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed");
              onSaved();
            } catch (err) {
              onError(err instanceof Error ? err.message : "Could not clear expiry");
            } finally {
              setSaving(false);
            }
          })();
        }}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
      >
        No expiry
      </button>
    </div>
  );
}
