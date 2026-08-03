import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, Loader2, Search } from "lucide-react";
import {
  L1_ACCESS_STAGE_LABELS,
  type L1AccessStage,
} from "@/lib/l1StageAccessMatrix";
import { isInL1July25MockAllowlist } from "@/lib/l1July25MockAllowlist";
import { isInFeMockAllowlist } from "@/lib/feMockAllowlist";
import {
  L1_JULY25_MOCK_TITLE,
  L1_JULY25_MOCK_URL,
} from "@/lib/l1July25MockConfig";
import {
  L1_JULY26_MAIN_ASSESSMENT_TITLE,
  L1_JULY26_MAIN_ASSESSMENT_URL,
} from "@/lib/l1July26MainConfig";
import {
  FE_PROJECT_MAIN_II_TITLE,
  FE_PROJECT_MAIN_II_URL,
  FE_PROJECT_MOCK_TITLE,
  FE_PROJECT_MOCK_URL,
} from "@/lib/feProjectConfig";
import {
  NXTMOCK_MAIN_TITLE,
  NXTMOCK_MAIN_URL,
  NXTMOCK_MOCK_TITLE,
  NXTMOCK_MOCK_URL,
} from "@/lib/nxtmockConfig";

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

type FallbackLink = {
  stage: L1AccessStage;
  stageLabel: string;
  linkKind: string;
  title: string;
  url: string;
  reason: string;
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

/** Hardcoded / allowlist links this UID may see when no admin grant covers the stage. */
function buildFallbackLinks(academyUserId: string): FallbackLink[] {
  const links: FallbackLink[] = [];
  const july25 = isInL1July25MockAllowlist(academyUserId);
  const feMock = isInFeMockAllowlist(academyUserId);

  if (july25) {
    links.push({
      stage: "online_assessment",
      stageLabel: L1_ACCESS_STAGE_LABELS.online_assessment,
      linkKind: "mock",
      title: L1_JULY25_MOCK_TITLE,
      url: L1_JULY25_MOCK_URL,
      reason: "July 25 mock allowlist (fallback)",
    });
    links.push({
      stage: "online_assessment",
      stageLabel: L1_ACCESS_STAGE_LABELS.online_assessment,
      linkKind: "main",
      title: L1_JULY26_MAIN_ASSESSMENT_TITLE,
      url: L1_JULY26_MAIN_ASSESSMENT_URL,
      reason: "July 26 main allowlist (fallback)",
    });
  }

  if (feMock) {
    links.push({
      stage: "fe_project",
      stageLabel: L1_ACCESS_STAGE_LABELS.fe_project,
      linkKind: "mock",
      title: FE_PROJECT_MOCK_TITLE,
      url: FE_PROJECT_MOCK_URL,
      reason: "FE mock allowlist (fallback)",
    });
  }

  // Always list known hardcoded cohort links so ops can compare; journey gates still apply live.
  links.push({
    stage: "fe_project",
    stageLabel: L1_ACCESS_STAGE_LABELS.fe_project,
    linkKind: "main",
    title: FE_PROJECT_MAIN_II_TITLE,
    url: FE_PROJECT_MAIN_II_URL,
    reason: "Hardcoded FE Main II URL (shown only if L1 cleared + FE pending)",
  });
  links.push({
    stage: "ai_mock",
    stageLabel: L1_ACCESS_STAGE_LABELS.ai_mock,
    linkKind: "main",
    title: NXTMOCK_MAIN_TITLE,
    url: NXTMOCK_MAIN_URL,
    reason: "Hardcoded NxtMock main (shown only if FE cleared)",
  });
  links.push({
    stage: "ai_mock",
    stageLabel: L1_ACCESS_STAGE_LABELS.ai_mock,
    linkKind: "mock",
    title: NXTMOCK_MOCK_TITLE,
    url: NXTMOCK_MOCK_URL,
    reason: "Hardcoded NxtMock practice (shown only if FE cleared)",
  });

  return links;
}

export function MasterAccessViewer({
  apiKey,
  initialUid = "",
}: {
  apiKey: string;
  initialUid?: string;
}) {
  const [uid, setUid] = useState(initialUid);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [livePreviewLoading, setLivePreviewLoading] = useState(false);

  const search = useCallback(async (overrideUid?: string) => {
    const academyUserId = (overrideUid ?? uid).trim();
    if (!academyUserId) {
      setError("Enter an academy user id");
      return;
    }
    setUid(academyUserId);
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
            ((res.status === 404
              ? "Access preview API not deployed yet — sync Replit from GitHub main, then republish"
              : (res.status === 500 || res.status === 502) && !(body as { error?: string }).error
                ? "API not available — Access preview needs the updated API + DATABASE_URL"
                : `Request failed (${res.status})`)),
        );
      }
      setPreview(body as PreviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [apiKey, uid]);

  useEffect(() => {
    if (initialUid.trim()) void search(initialUid);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from URL
  }, [initialUid]);

  const fallbackLinks = useMemo(
    () => (preview ? buildFallbackLinks(preview.academyUserId) : []),
    [preview],
  );

  const grantCovered = useMemo(() => {
    const set = new Set<string>();
    for (const g of preview?.studentVisible ?? []) {
      set.add(`${g.stage}:${g.linkKind}`);
    }
    return set;
  }, [preview]);

  async function openLiveDashboard() {
    const academyUserId = (preview?.academyUserId || uid).trim();
    if (!academyUserId || !apiKey) return;
    setLivePreviewLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/preview-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey.trim(),
        },
        body: JSON.stringify({ academyUserId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error ?? "Could not mint preview link");
      }
      const url = (body as { previewUrl?: string }).previewUrl;
      if (!url) throw new Error("No previewUrl returned");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live preview failed");
    } finally {
      setLivePreviewLoading(false);
    }
  }

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
          Search an academy UID. Top = Access Loader grants for that user. Bottom = grant links
          plus fallback/allowlist links, and a button to open their live dashboard.
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
          <div className="irp-card p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-extrabold text-[#0d1117]">
                  Access for <span className="font-mono text-sm">{preview.academyUserId}</span>
                </h3>
                <p className="mt-1 text-xs text-[#6e6a8a]">
                  {preview.grants.length} grant{preview.grants.length === 1 ? "" : "s"} ·{" "}
                  {preview.studentVisible.length} currently visible from Access Loader
                </p>
              </div>
              <button
                type="button"
                disabled={livePreviewLoading}
                onClick={() => void openLiveDashboard()}
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(103,65,217,0.25)] bg-white px-3 py-2 text-xs font-bold text-[#6741d9] disabled:opacity-50"
              >
                {livePreviewLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                Open live student dashboard
              </button>
            </div>

            {preview.grants.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-bold">No Access Loader grants for this UID yet.</p>
                <p className="mt-1 text-xs">
                  Go to <strong>Access Loader</strong>, upload this UID (CSV or paste), pick stage +
                  mock/main, paste URL, set expiry, Save — then search again here. Until then the
                  student only sees fallback/allowlist links below.
                </p>
              </div>
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

          <div className="irp-card p-5">
            <h3 className="mb-1 font-display text-base font-extrabold text-[#0d1117]">
              Student preview
            </h3>
            <p className="mb-4 text-xs text-[#6e6a8a]">
              Purple cards = active Access Loader grants. Gray cards = fallback/hardcoded links
              (allowlist or journey-gated). Journey gates (cleared L1 / FE / etc.) still apply on
              the live dashboard.
            </p>

            {preview.studentVisible.length > 0 ? (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {preview.studentVisible.map((slot) => (
                  <div
                    key={`grant-${slot.stage}-${slot.linkKind}-${slot.url}`}
                    className="flex flex-col rounded-xl border border-[rgba(103,65,217,0.18)] bg-[linear-gradient(120deg,#f8f7ff_0%,#eef2ff_100%)] p-4"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                      Grant · {slot.stageLabel} · {slot.linkKind}
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
                      Open grant link
                    </a>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
              Fallback / hardcoded surface
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {fallbackLinks.map((link) => {
                const covered = grantCovered.has(`${link.stage}:${link.linkKind}`);
                return (
                  <div
                    key={`fb-${link.stage}-${link.linkKind}-${link.url}`}
                    className={`flex flex-col rounded-xl border p-4 ${
                      covered
                        ? "border-slate-200 bg-slate-50 opacity-60"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6e6a8a]">
                      Fallback · {link.stageLabel} · {link.linkKind}
                      {covered ? " · overridden by grant" : ""}
                    </p>
                    <p className="mt-1 font-display text-sm font-extrabold text-ink">
                      {link.title}
                    </p>
                    <p className="mt-1 text-xs text-muted2">{link.reason}</p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#3b5bdb]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open fallback link
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
