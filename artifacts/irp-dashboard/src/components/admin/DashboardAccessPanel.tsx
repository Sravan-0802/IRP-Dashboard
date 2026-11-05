import { useEffect, useState } from "react";
import { CreditCard, Database, Eye, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { parseAcademyUserIds } from "@/lib/parseAcademyUserIds";

type DashboardAccessSummary = {
  assessmentRows: number;
  eligibleUsers: number;
  unpaidUsersTotal: number;
  paidDashboardUsers: number;
  eligibleYetToPay?: number;
  yogCohortEligible?: number;
  eligible2028?: number;
  eligible2029?: number;
  eligible2030?: number;
  yogCohortAccess?: number;
  unpaidEligibleUsers: number;
  syncStatus: string | null;
  lastSyncedAt: string | null;
};

export function DashboardAccessPanel({ apiKey }: { apiKey: string }) {
  const [previewUid, setPreviewUid] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [summary, setSummary] = useState<DashboardAccessSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [uidsText, setUidsText] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualMessage, setManualMessage] = useState("");
  const [manualError, setManualError] = useState("");
  const [grantsError, setGrantsError] = useState("");
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [grants, setGrants] = useState<{ userId: string; grantedAt: string }[]>([]);
  const parsedIds = parseAcademyUserIds(uidsText);

  async function loadGrants() {
    setGrantsLoading(true);
    setGrantsError("");
    try {
      const res = await fetch("/api/admin/dashboard-access/manual", {
        cache: "no-store", headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load manual grants");
      setGrants(body.grants);
    } catch (err) {
      setGrantsError(err instanceof Error ? err.message : "Could not load manual grants");
    } finally {
      setGrantsLoading(false);
    }
  }

  async function updateManualAccess(action: "grant" | "revoke") {
    if (manualBusy || !parsedIds.length) return;
    setManualBusy(true);
    setManualMessage("");
    setManualError("");
    try {
      const res = await fetch(`/api/admin/dashboard-access/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey.trim() },
        body: JSON.stringify({ academyUserIds: parsedIds }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update manual access");
      setManualMessage(action === "grant"
        ? `${body.granted} granted; ${body.alreadyGranted} already granted (${body.requested} requested).`
        : `${body.revoked} manual grants removed (${body.requested} requested). Normal status rules now apply.`);
      await Promise.all([loadGrants(), loadSummary()]);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Could not update manual access");
    } finally {
      setManualBusy(false);
    }
  }

  async function loadSummary() {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const res = await fetch("/api/admin/dashboard-access/summary", {
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error ?? `Could not load summary (${res.status})`);
      }
      setSummary(body as DashboardAccessSummary);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Could not load dashboard access summary");
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
    void loadGrants();
  }, [apiKey]);

  function formatSummaryDate(value: string | null) {
    if (!value) return "Not recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });
  }

  async function openStudentPreview() {
    const academyUserId = previewUid.trim();
    if (!academyUserId || previewing) return;
    setPreviewing(true);
    setPreviewError("");
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
        throw new Error((body as { error?: string }).error ?? `Preview failed (${res.status})`);
      }
      let previewUrl = (body as { previewUrl?: string }).previewUrl;
      if (!previewUrl) throw new Error("No preview URL returned");

      // Prefer opening on the same origin the admin is using (local vs Replit).
      try {
        const parsed = new URL(previewUrl);
        const token = parsed.searchParams.get("auth_token");
        if (token) {
          previewUrl = `${window.location.origin}/?auth_token=${encodeURIComponent(token)}`;
        }
      } catch {
        // keep server URL
      }

      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Could not open student preview");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="irp-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#6741d9]" />
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#0d1117]">
                Dashboard access summary
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[#6e6a8a]">
                Access still needs IRP ELIGIBLE + LP ACTIVE + product ACTIVE unless a manual grant exists. Payment status is not an access requirement. The counts below report source statuses; manual grants are listed separately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={summaryLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(103,65,217,0.18)] bg-white px-3 py-1.5 text-xs font-bold text-[#6741d9] transition-colors hover:bg-[#f3f0ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${summaryLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {summaryError ? (
          <p className="rounded-lg bg-[#fff0f4] px-3 py-2 text-sm font-semibold text-[#c2255c]">
            {summaryError}
          </p>
        ) : summaryLoading && !summary ? (
          <div className="flex items-center gap-2 py-5 text-sm font-semibold text-[#6e6a8a]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading access counts…
          </div>
        ) : summary ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[rgba(103,65,217,0.15)] bg-[#f8f7ff] p-4">
                <Users className="h-4 w-4 text-[#6741d9]" />
                <p className="mt-3 text-2xl font-extrabold text-[#0d1117]">
                  {summary.eligibleUsers.toLocaleString("en-IN")}
                </p>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6e6a8a]">
                  Eligible users
                </p>
                <p className="mt-1 text-xs text-[#6e6a8a]">IRP status is ELIGIBLE</p>
              </div>
              <div className="rounded-xl border border-[rgba(59,91,219,0.15)] bg-[#f3f6ff] p-4">
                <Database className="h-4 w-4 text-[#3b5bdb]" />
                <p className="mt-3 text-2xl font-extrabold text-[#0d1117]">
                  {summary.assessmentRows.toLocaleString("en-IN")}
                </p>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6e6a8a]">
                  Assessment records
                </p>
                <p className="mt-1 text-xs text-[#6e6a8a]">Rows in the access source mirror</p>
              </div>
              <div className="rounded-xl border border-[rgba(12,166,120,0.2)] bg-[#effbf6] p-4">
                <ShieldCheck className="h-4 w-4 text-[#0ca678]" />
                <p className="mt-3 text-2xl font-extrabold text-[#0d1117]">
                  {summary.paidDashboardUsers.toLocaleString("en-IN")}
                </p>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6e6a8a]">
                  Status-qualified users
                </p>
                <p className="mt-1 text-xs text-[#6e6a8a]">All three source conditions met; sign-in and enrollment are still required</p>
              </div>
              <div className="rounded-xl border border-[rgba(245,159,0,0.22)] bg-[#fff9e9] p-4">
                <CreditCard className="h-4 w-4 text-[#e67700]" />
                <p className="mt-3 text-2xl font-extrabold text-[#0d1117]">
                  {summary.unpaidUsersTotal.toLocaleString("en-IN")}
                </p>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6e6a8a]">
                  Unpaid students
                </p>
                <p className="mt-1 text-xs text-[#6e6a8a]">Payment reporting only; does not determine dashboard access</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6e6a8a]">
              <span>
                2028 IRP eligible: <strong className="text-[#0d1117]">{(summary.eligible2028 ?? 0).toLocaleString("en-IN")}</strong>
                {" · "}
                2029: <strong className="text-[#0d1117]">{(summary.eligible2029 ?? 0).toLocaleString("en-IN")}</strong>
                {" · "}
                2030: <strong className="text-[#0d1117]">{(summary.eligible2030 ?? 0).toLocaleString("en-IN")}</strong>
                {" · "}
                Eligible and yet to pay: <strong className="text-[#0d1117]">{(summary.eligibleYetToPay ?? 0).toLocaleString("en-IN")}</strong>
                <span className="text-[#98a2b3]"> · payment reporting only</span>
              </span>
              <span>
                Sync status: <strong className="capitalize text-[#0d1117]">{summary.syncStatus ?? "Not recorded"}</strong>
              </span>
              <span>
                Last BigQuery sync: <strong className="text-[#0d1117]">{formatSummaryDate(summary.lastSyncedAt)}</strong>
              </span>
            </div>
          </>
        ) : null}
      </div>

      <div className="irp-card p-5">
        <div className="mb-4 flex items-start gap-2">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[#6741d9]" />
          <div>
            <h2 className="font-display text-lg font-extrabold text-[#0d1117]">
              Preview student dashboard
            </h2>
            <p className="mt-1 max-w-xl text-sm text-[#6e6a8a]">
              Paste one Academy User ID to open that student&apos;s real dashboard in a new tab
              (same view they see after login).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[280px] flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
              Academy User ID
            </label>
            <input
              type="text"
              value={previewUid}
              onChange={(e) => setPreviewUid(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void openStudentPreview();
                }
              }}
              placeholder="e.g. bd7a1006-18af-475b-af4b-6c49c3340abd"
              className="w-full rounded-xl border border-[rgba(103,65,217,0.15)] bg-white px-3 py-2.5 font-mono text-xs text-[#0d1117] placeholder:font-sans placeholder:text-[#6e6a8a] focus:border-[#6741d9] focus:outline-none focus:ring-2 focus:ring-[rgba(103,65,217,0.12)]"
            />
          </div>
          <button
            type="button"
            disabled={!previewUid.trim() || previewing}
            onClick={() => void openStudentPreview()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#3b5bdb] to-[#6741d9] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Open preview
          </button>
        </div>
        {previewError ? (
          <p className="mt-3 text-sm font-semibold text-[#c2255c]">{previewError}</p>
        ) : null}
      </div>

      <div className="irp-card p-5">
        <h2 className="font-display text-lg font-extrabold text-[#0d1117]">Give manual dashboard access</h2>
        <p className="mt-1 text-sm text-[#6e6a8a]">
          Allow internal Academy User IDs to open the dashboard regardless of IRP, LP, or product statuses.
          This override does not change assessment links — Access Loader still does that.
        </p>
        <label htmlFor="manual-access-uids" className="mb-2 mt-4 block text-sm font-semibold">Academy User IDs</label>
        <textarea id="manual-access-uids" rows={5} value={uidsText}
          onChange={e => { setUidsText(e.target.value); setManualMessage(""); setManualError(""); }}
          placeholder="Paste UIDs separated by newlines or commas, or CSV with an academy_user_id column."
          className="w-full rounded-xl border border-[#d0d5dd] bg-white p-3 font-mono text-xs"
          disabled={manualBusy} />
        <p className="mt-1 text-xs text-[#6e6a8a]">{parsedIds.length} unique UIDs parsed · Maximum 1,000 per request</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={() => void updateManualAccess("grant")}
            disabled={manualBusy || !parsedIds.length || parsedIds.length > 1000}
            className="rounded-xl bg-[#6741d9] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {manualBusy ? "Updating…" : "Give dashboard access"}
          </button>
          <button type="button" onClick={() => void updateManualAccess("revoke")}
            disabled={manualBusy || !parsedIds.length || parsedIds.length > 1000}
            className="rounded-xl border border-[#d0d5dd] px-4 py-2.5 text-sm font-bold disabled:opacity-40">
            Remove manual access
          </button>
        </div>
        <p className="mt-2 text-xs text-[#6e6a8a]">Removing manual access restores normal eligibility checks. It does not delete the student or their assessments.</p>
        {manualMessage && <p role="status" className="mt-3 text-sm text-green-700">{manualMessage}</p>}
        {manualError && <p role="alert" className="mt-3 text-sm text-red-700">{manualError}</p>}
        <div className="mb-3 mt-6 flex items-center justify-between">
          <h3 className="text-sm font-bold">Recent grants</h3>
          <button type="button" disabled={grantsLoading || manualBusy} onClick={() => void loadGrants()} className="text-sm text-[#6741d9]">Refresh grants</button>
        </div>
        {grantsError ? <p role="alert" className="text-sm text-red-700">{grantsError}</p>
          : grantsLoading ? <p className="text-sm">Loading grants…</p>
          : grants.length === 0 ? <p className="text-sm text-[#6e6a8a]">No active manual grants.</p>
          : <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b"><th className="py-2 pr-4">Academy User ID</th><th className="py-2">Granted at (IST)</th></tr></thead>
              <tbody>{grants.map(grant => <tr key={grant.userId} className="border-b">
                <td className="py-2 pr-4 font-mono text-xs">{grant.userId}</td>
                <td className="whitespace-nowrap py-2">{formatSummaryDate(grant.grantedAt)}</td>
              </tr>)}</tbody>
            </table>
            <p className="mt-2 text-xs text-[#6e6a8a]">Showing up to 100 most recent active grants.</p>
          </div>}
      </div>
    </div>
  );
}
