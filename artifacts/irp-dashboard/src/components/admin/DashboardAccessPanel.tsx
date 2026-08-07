import { useMemo, useState } from "react";
import { Eye, KeyRound, Loader2, Upload } from "lucide-react";
import { parseAcademyUserIds } from "@/lib/parseAcademyUserIds";

type GrantResult = {
  requested: number;
  unlocked: number;
  alreadyHadAccess: number;
  enrolledBasic?: number;
  enrolledAssessment?: number;
  unpaidTotal: number;
};

type RevokeResult = {
  requested: number;
  locked: number;
  alreadyUnpaid: number;
  unpaidTotal: number;
};

export function DashboardAccessPanel({ apiKey }: { apiKey: string }) {
  const [uidsText, setUidsText] = useState("");
  const [csvName, setCsvName] = useState("");
  const [saving, setSaving] = useState<"grant" | "revoke" | null>(null);
  const [error, setError] = useState("");
  const [grantResult, setGrantResult] = useState<GrantResult | null>(null);
  const [revokeResult, setRevokeResult] = useState<RevokeResult | null>(null);

  const [previewUid, setPreviewUid] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const parsedIds = useMemo(() => parseAcademyUserIds(uidsText), [uidsText]);

  function onCsvFile(file: File | null) {
    if (!file) return;
    setCsvName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setUidsText((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
    };
    reader.readAsText(file);
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

  async function grantAccess() {
    if (parsedIds.length === 0 || saving) return;
    setSaving("grant");
    setError("");
    setGrantResult(null);
    setRevokeResult(null);
    try {
      const res = await fetch("/api/admin/dashboard-access/grant", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey.trim(),
        },
        body: JSON.stringify({ academyUserIds: parsedIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error ?? `Grant failed (${res.status})`);
      }
      setGrantResult({
        requested: Number((body as GrantResult).requested ?? 0),
        unlocked: Number((body as GrantResult).unlocked ?? 0),
        alreadyHadAccess: Number((body as GrantResult).alreadyHadAccess ?? 0),
        enrolledBasic: Number((body as GrantResult).enrolledBasic ?? 0),
        enrolledAssessment: Number((body as GrantResult).enrolledAssessment ?? 0),
        unpaidTotal: Number((body as GrantResult).unpaidTotal ?? 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grant dashboard access");
    } finally {
      setSaving(null);
    }
  }

  async function revokeAccess() {
    if (parsedIds.length === 0 || saving) return;
    if (
      !window.confirm(
        `Mark ${parsedIds.length} user${parsedIds.length === 1 ? "" : "s"} as Unpaid? They will see the payment gate instead of the dashboard.`,
      )
    ) {
      return;
    }
    setSaving("revoke");
    setError("");
    setGrantResult(null);
    setRevokeResult(null);
    try {
      const res = await fetch("/api/admin/dashboard-access/revoke", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey.trim(),
        },
        body: JSON.stringify({ academyUserIds: parsedIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error ?? `Revoke failed (${res.status})`);
      }
      setRevokeResult({
        requested: Number((body as RevokeResult).requested ?? 0),
        locked: Number((body as RevokeResult).locked ?? 0),
        alreadyUnpaid: Number((body as RevokeResult).alreadyUnpaid ?? 0),
        unpaidTotal: Number((body as RevokeResult).unpaidTotal ?? 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke dashboard access");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5">
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
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#6741d9]" />
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#0d1117]">
                Grant dashboard access
              </h2>
              <p className="mt-1 max-w-xl text-sm text-[#6e6a8a]">
                Paste Academy User IDs for new students. This marks them Paid and
                enrolls them in the dashboard if they are missing IRP assessment
                data (fixes &quot;You&apos;re not in our data yet&quot;). Stage
                assessment links still use Access Loader.
              </p>
            </div>
          </div>
        </div>

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6e6a8a]">
          Academy User IDs
        </label>
        <textarea
          value={uidsText}
          onChange={(e) => setUidsText(e.target.value)}
          rows={8}
          placeholder={"Paste one ID per line, or CSV with an academy_user_id column…"}
          className="w-full resize-y rounded-xl border border-[rgba(103,65,217,0.15)] bg-white px-3 py-2.5 font-mono text-xs text-[#0d1117] placeholder:font-sans placeholder:text-[#6e6a8a] focus:border-[#6741d9] focus:outline-none focus:ring-2 focus:ring-[rgba(103,65,217,0.12)]"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[rgba(103,65,217,0.18)] bg-white px-3 py-1.5 text-xs font-semibold text-[#6741d9] hover:bg-[#f3f0ff]">
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
          <span className="text-xs font-semibold text-[#6e6a8a]">
            {parsedIds.length} unique ID{parsedIds.length === 1 ? "" : "s"}
          </span>
        </div>

        {error ? (
          <p className="mt-3 text-sm font-semibold text-[#c2255c]">{error}</p>
        ) : null}

        {grantResult ? (
          <div className="mt-3 rounded-xl border border-[rgba(12,166,120,0.25)] bg-[#e8faf4] px-4 py-3 text-sm text-[#0d1117]">
            <p className="font-bold text-[#099268]">Dashboard access granted</p>
            <p className="mt-1 text-[#6e6a8a]">
              Requested <span className="font-semibold text-[#0d1117]">{grantResult.requested}</span>
              {" · "}Payment unlocked{" "}
              <span className="font-semibold text-[#0d1117]">{grantResult.unlocked}</span>
              {" · "}Already paid{" "}
              <span className="font-semibold text-[#0d1117]">{grantResult.alreadyHadAccess}</span>
              {" · "}Enrolled (new){" "}
              <span className="font-semibold text-[#0d1117]">{grantResult.enrolledAssessment ?? 0}</span>
              {" · "}Still unpaid overall{" "}
              <span className="font-semibold text-[#0d1117]">{grantResult.unpaidTotal}</span>
            </p>
          </div>
        ) : null}

        {revokeResult ? (
          <div className="mt-3 rounded-xl border border-[rgba(232,89,12,0.25)] bg-[#fff4e6] px-4 py-3 text-sm text-[#0d1117]">
            <p className="font-bold text-[#e8590c]">Marked unpaid</p>
            <p className="mt-1 text-[#6e6a8a]">
              Requested <span className="font-semibold text-[#0d1117]">{revokeResult.requested}</span>
              {" · "}Newly unpaid{" "}
              <span className="font-semibold text-[#0d1117]">{revokeResult.locked}</span>
              {" · "}Already unpaid{" "}
              <span className="font-semibold text-[#0d1117]">{revokeResult.alreadyUnpaid}</span>
              {" · "}Unpaid total{" "}
              <span className="font-semibold text-[#0d1117]">{revokeResult.unpaidTotal}</span>
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={parsedIds.length === 0 || saving !== null}
            onClick={() => void grantAccess()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#3b5bdb] to-[#6741d9] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving === "grant" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Grant dashboard access
          </button>
          <button
            type="button"
            disabled={parsedIds.length === 0 || saving !== null}
            onClick={() => void revokeAccess()}
            className="rounded-xl border border-[rgba(200,37,92,0.25)] bg-white px-4 py-2.5 text-sm font-semibold text-[#c2255c] hover:bg-[#fff0f3] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving === "revoke" ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" /> Mark unpaid…
              </span>
            ) : (
              "Mark unpaid instead"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
