import { useCallback, useState } from "react";
import { ExternalLink, Eye, Loader2, Search } from "lucide-react";
import {
  L1_ACCESS_STAGE_LABELS,
  type L1AccessStage,
} from "@/lib/l1StageAccessMatrix";

type PreviewGrant = {
  batchId: number;
  name: string | null;
  stage: L1AccessStage;
  linkKind: string;
  url: string;
  expiresAt: string | null;
  enabled: boolean;
  expired: boolean;
  studentVisible: boolean;
};

type PreviewSlot = {
  stage: L1AccessStage;
  stageLabel: string;
  linkKind: string;
  url: string;
  batchName: string | null;
  expiresAt: string | null;
};

type PreviewResponse = {
  academyUserId: string;
  grants: PreviewGrant[];
  studentVisible: PreviewSlot[];
};

function formatWhen(iso: string | null): string {
  if (!iso) return "No expiry";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusPill(g: PreviewGrant) {
  if (!g.enabled) {
    return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Disabled</span>;
  }
  if (g.expired) {
    return <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Expired</span>;
  }
  return <span className="rounded-md bg-[#e8faf0] px-2 py-0.5 text-[10px] font-bold text-teal">Visible to student</span>;
}

export function MasterAccessViewer({ apiKey }: { apiKey: string }) {
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const search = useCallback(async () => {
    const academyUserId = uid.trim();
    if (!academyUserId) {
      setError("Enter an academy user id");
      return;
    }
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch(
        `/api/admin/access-preview/${encodeURIComponent(academyUserId)}`,
        { headers: { "x-api-key": apiKey.trim() } },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (body as { error?: string }).error ??
            ((res.status === 500 || res.status === 502) && !(body as { error?: string }).error
              ? "API not available — Access preview needs the updated API + DATABASE_URL"
              : `Request failed (${res.status})`),
        );
      }
      setPreview(body as PreviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [apiKey, uid]);

  return (
    <div className="space-y-6">
      <div className="irp-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Eye className="h-4 w-4 text-[#6741d9]" />
          <h2 className="font-display text-lg font-extrabold text-[#0d1117]">
            Master access viewer
          </h2>
        </div>
        <p className="mb-4 max-w-2xl text-sm text-[#6e6a8a]">
          Search an academy UID to see their access grants (top) and a student-facing preview of
          which stage links would currently show (below). Use this to verify grants and expiry.
        </p>

        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="academy_user_id / UUID"
            className="min-w-[280px] flex-1 rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={loading || !uid.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6741d9] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </form>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      {preview ? (
        <>
          {/* Access on top */}
          <div className="irp-card p-5">
            <h3 className="mb-1 font-display text-base font-extrabold text-[#0d1117]">
              Access for <span className="font-mono text-sm">{preview.academyUserId}</span>
            </h3>
            <p className="mb-3 text-xs text-[#6e6a8a]">
              {preview.grants.length} grant{preview.grants.length === 1 ? "" : "s"} ·{" "}
              {preview.studentVisible.length} currently visible to student
            </p>

            {preview.grants.length === 0 ? (
              <p className="text-sm text-[#6e6a8a]">
                No access batches include this UID. Student keeps fallback/hardcoded links only.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(103,65,217,0.12)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                      <th className="px-2 py-2">Batch</th>
                      <th className="px-2 py-2">Stage</th>
                      <th className="px-2 py-2">Kind</th>
                      <th className="px-2 py-2">Expires</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.grants.map((g) => (
                      <tr
                        key={`${g.batchId}-${g.stage}-${g.linkKind}`}
                        className="border-b border-[rgba(103,65,217,0.06)]"
                      >
                        <td className="px-2 py-2 font-semibold">
                          {g.name || `#${g.batchId}`}
                        </td>
                        <td className="px-2 py-2">
                          {L1_ACCESS_STAGE_LABELS[g.stage] ?? g.stage}
                        </td>
                        <td className="px-2 py-2 capitalize">{g.linkKind}</td>
                        <td className="px-2 py-2 text-xs">{formatWhen(g.expiresAt)}</td>
                        <td className="px-2 py-2">{statusPill(g)}</td>
                        <td className="px-2 py-2">
                          <a
                            href={g.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#6741d9] hover:underline"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Student preview below */}
          <div className="irp-card p-5">
            <h3 className="mb-1 font-display text-base font-extrabold text-[#0d1117]">
              Student preview
            </h3>
            <p className="mb-4 text-xs text-[#6e6a8a]">
              What this user would see from admin grants right now (enabled + not expired). Stages
              without a grant still use existing date/allowlist fallbacks on the live dashboard.
            </p>

            {preview.studentVisible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-[#6e6a8a]">
                No active grant links for this UID. Dashboard callouts fall back to hardcoded /
                allowlist behavior.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {preview.studentVisible.map((slot) => (
                  <div
                    key={`${slot.stage}-${slot.linkKind}-${slot.url}`}
                    className="flex flex-col rounded-xl border border-[rgba(103,65,217,0.18)] bg-[linear-gradient(120deg,#f8f7ff_0%,#eef2ff_100%)] p-4"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                      {slot.stageLabel} · {slot.linkKind}
                    </p>
                    <p className="mt-1 font-display text-sm font-extrabold text-ink">
                      {slot.batchName || "Access grant"}
                    </p>
                    <p className="mt-1 text-xs text-muted2">
                      {slot.expiresAt
                        ? `Expires ${formatWhen(slot.expiresAt)}`
                        : "No expiry"}
                    </p>
                    <a
                      href={slot.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-pop mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open link (as student would)
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
