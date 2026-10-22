import { useCallback, useEffect, useState } from "react";
import { Download, KeyRound, Loader2, RefreshCw, Search } from "lucide-react";

type AuthCodeLog = {
  id: number;
  createdAt: string;
  endpoint: string;
  outcome: string;
  statusCode: number;
  userId: string | null;
  userKnown: boolean | null;
  tokenId: number | null;
  bodyKeys: string | null;
  callerIp: string | null;
  userAgent: string | null;
  requestId: string | null;
  durationMs: number | null;
  error: string | null;
};

type LogsResponse = {
  logs?: AuthCodeLog[];
  summary?: { last24h: Record<string, number>; last7d: Record<string, number> };
  error?: string;
};

const OUTCOMES: { value: string; label: string; tone: string }[] = [
  { value: "issued", label: "Token issued", tone: "bg-[#ecfdf3] text-[#067647]" },
  { value: "missing_user", label: "No student sent", tone: "bg-amber-50 text-amber-700" },
  { value: "unauthorized", label: "Wrong API key", tone: "bg-orange-50 text-orange-700" },
  { value: "invalid_json", label: "Broken request", tone: "bg-slate-100 text-slate-600" },
  { value: "error", label: "Server error", tone: "bg-red-50 text-red-600" },
];

function outcomeMeta(value: string) {
  return OUTCOMES.find((o) => o.value === value) ?? { value, label: value, tone: "bg-slate-100 text-slate-600" };
}

function formatIst(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function downloadCsv(rows: AuthCodeLog[]) {
  const header = ["time_ist", "endpoint", "outcome", "status", "user_id", "user_in_irp_data", "token_id", "body_fields", "caller_ip", "request_id", "duration_ms", "error"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      formatIst(r.createdAt),
      r.endpoint,
      r.outcome,
      r.statusCode,
      r.userId,
      r.userKnown == null ? "" : r.userKnown ? "yes" : "no",
      r.tokenId,
      r.bodyKeys,
      r.callerIp,
      r.requestId,
      r.durationMs,
      r.error,
    ]
      .map(escape)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `login-token-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(href);
}

export function AuthCodeLogsPanel({ apiKey }: { apiKey: string }) {
  const [logs, setLogs] = useState<AuthCodeLog[]>([]);
  const [summary, setSummary] = useState<LogsResponse["summary"]>();
  const [outcome, setOutcome] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (filters: { outcome: string; userId: string }) => {
      if (!apiKey.trim()) return;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ limit: "300" });
        if (filters.outcome) params.set("outcome", filters.outcome);
        if (filters.userId.trim()) params.set("userId", filters.userId.trim());
        const res = await fetch(`/api/admin/auth-code-logs?${params}`, { headers: { "x-api-key": apiKey.trim() } });
        const body = (await res.json().catch(() => ({}))) as LogsResponse;
        if (!res.ok) throw new Error(body.error ?? "Could not load login logs");
        setLogs(Array.isArray(body.logs) ? body.logs : []);
        setSummary(body.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load login logs");
      } finally {
        setLoading(false);
      }
    },
    [apiKey],
  );

  useEffect(() => {
    void load({ outcome: "", userId: "" });
  }, [load]);

  return (
    <section className="irp-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#6741d9]" />
            <h2 className="font-display text-lg font-extrabold text-[#0d1117]">Login token logs</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[#6e6a8a]">
            Every call the forms login service makes to create a dashboard login token. Tokens and API keys are never
            stored. Kept for 90 days.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(logs)}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => void load({ outcome, userId })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                const next = outcome === o.value ? "" : o.value;
                setOutcome(next);
                void load({ outcome: next, userId });
              }}
              className={`rounded-xl border p-3 text-left ${
                outcome === o.value ? "border-[#6741d9] bg-[#f3f0ff]" : "border-[rgba(103,65,217,0.12)] bg-white"
              }`}
            >
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${o.tone}`}>{o.label}</span>
              <p className="mt-2 font-display text-2xl font-extrabold text-[#0d1117]">
                {(summary.last24h[o.value] ?? 0).toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-[#6e6a8a]">
                last 24 hours · {(summary.last7d[o.value] ?? 0).toLocaleString("en-IN")} in 7 days
              </p>
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load({ outcome, userId });
        }}
      >
        <select
          value={outcome}
          onChange={(event) => {
            setOutcome(event.target.value);
            void load({ outcome: event.target.value, userId });
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All results</option>
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          placeholder="Student user ID"
          className="w-72 max-w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#6741d9] px-3 py-2 text-xs font-bold text-white"
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </button>
      </form>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      {logs.length === 0 && !loading ? (
        <p className="text-sm text-[#6e6a8a]">No login token requests logged yet for this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-[rgba(103,65,217,0.12)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                <th className="px-2 py-2">Time (IST)</th>
                <th className="px-2 py-2">Result</th>
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Fields sent</th>
                <th className="px-2 py-2">Endpoint</th>
                <th className="px-2 py-2">Took</th>
                <th className="px-2 py-2">Caller / request</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const meta = outcomeMeta(log.outcome);
                return (
                  <tr key={log.id} className="border-b border-[rgba(103,65,217,0.06)] align-top">
                    <td className="whitespace-nowrap px-2 py-2 text-[#0d1117]">{formatIst(log.createdAt)}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${meta.tone}`}>
                        {log.statusCode} · {meta.label}
                      </span>
                      {log.error ? <p className="mt-1 max-w-xs text-xs text-red-600">{log.error}</p> : null}
                    </td>
                    <td className="px-2 py-2">
                      {log.userId ? (
                        <>
                          <p className="font-mono text-xs text-[#0d1117]">{log.userId}</p>
                          {log.userKnown === false ? (
                            <p className="text-[11px] font-semibold text-amber-700">Not in IRP student data</p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-[#6e6a8a]">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-[#344054]">{log.bodyKeys ?? "-"}</td>
                    <td className="px-2 py-2 text-xs text-[#344054]">{log.endpoint}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-[#344054]">
                      {log.durationMs != null ? `${log.durationMs} ms` : "-"}
                    </td>
                    <td className="px-2 py-2 text-xs text-[#6e6a8a]">
                      <p>{log.callerIp ?? "-"}</p>
                      {log.requestId ? <p className="font-mono text-[10px]">{log.requestId}</p> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
