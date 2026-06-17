import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, Users, MousePointerClick, UserRound, MessageSquare, Star } from "lucide-react";

type AnalyticsMetric = {
  eventType: string;
  label: string;
  totalClicks: number;
  uniqueUsers: number;
};

type AnalyticsUser = {
  academyUserId: string;
  userName: string | null;
  totalEvents: number;
  firstSeen: string | null;
  lastSeen: string | null;
  metrics: Array<{ eventType: string; clicks: number }>;
};

type FeedbackQA = { question: string; answer: string };

type AnalyticsFeedback = {
  id: string;
  academyUserId: string;
  userName: string | null;
  rating: number;
  ratingLabel: string;
  responses: FeedbackQA[];
  submittedAt: string | null;
};

type AnalyticsSummary = {
  trackingSince: string | null;
  generatedAt: string;
  totalVisitors: number;
  events: AnalyticsMetric[];
  daily: Array<{
    date: string;
    metrics: Array<{ eventType: string; clicks: number; users: number }>;
  }>;
  users: AnalyticsUser[];
  feedbacks: AnalyticsFeedback[];
  feedbackCount: number;
  avgRating: number | null;
};

const STORAGE_KEY = "irp_analytics_admin_key";

function getStoredKey(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeKey(key: string): void {
  try {
    if (key) sessionStorage.setItem(STORAGE_KEY, key);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function captureKeyFromUrl(): string {
  try {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("key")?.trim();
    if (key) {
      storeKey(key);
      url.searchParams.delete("key");
      window.history.replaceState({}, document.title, url.toString());
      return key;
    }
  } catch {
    // ignore
  }
  return getStoredKey();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AnalyticsPage() {
  const [apiKey, setApiKey] = useState(captureKeyFromUrl);
  const [inputKey, setInputKey] = useState(apiKey);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (key: string) => {
    if (!key.trim()) {
      setError("Enter your analytics admin key to view stats.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analytics/dashboard", {
        headers: { "x-api-key": key.trim() },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      setData(body as AnalyticsSummary);
      storeKey(key.trim());
      setApiKey(key.trim());
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey) void load(apiKey);
  }, [apiKey, load]);

  const dailyColumns = useMemo(() => {
    if (!data?.events.length) return [];
    return data.events.map((e) => ({
      eventType: e.eventType,
      label: e.label.replace(" clicks", "").replace(" opens", "").replace("Users who visited the dashboard", "Visits"),
    }));
  }, [data]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyId = useCallback((id: string) => {
    void navigator.clipboard?.writeText(id).then(
      () => {
        setCopiedId(id);
        window.setTimeout(() => setCopiedId(null), 1500);
      },
      () => {},
    );
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#f6f7fb] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6741d9]/70">IRP 2.0</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0d1117] sm:text-3xl">
              Dashboard Analytics
            </h1>
            <p className="mt-1 text-sm text-[#6e6a8a]">
              Tracks visits and sidebar interactions — Dashboard, Assessment Calendar, Feedback, and Help & Support.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(apiKey || inputKey)}
            disabled={loading || !(apiKey || inputKey).trim()}
            className="flex items-center gap-2 rounded-xl border border-[rgba(59,91,219,0.18)] bg-white px-4 py-2.5 text-sm font-bold text-[#3b5bdb] transition-colors hover:bg-[#eef2ff] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {!apiKey && (
          <div className="irp-card max-w-md p-5">
            <label htmlFor="analytics-key" className="text-sm font-bold text-[#0d1117]">
              Admin key
            </label>
            <p className="mt-1 text-xs text-[#6e6a8a]">
              Set <code className="rounded bg-[#eef2ff] px-1">ANALYTICS_ADMIN_KEY</code> on the API server, or use{" "}
              <code className="rounded bg-[#eef2ff] px-1">dev</code> locally when no key is configured.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                id="analytics-key"
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Enter admin key"
                className="flex-1 rounded-xl border border-[rgba(103,65,217,0.15)] bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void load(inputKey)}
                className="rounded-xl bg-[#6741d9] px-4 py-2 text-sm font-bold text-white"
              >
                View
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.events.map((metric) => (
                <div key={metric.eventType} className="irp-card p-5">
                  <div className="mb-3 flex items-center gap-2 text-[#6741d9]">
                    {metric.eventType === "dashboard_visit" ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <MousePointerClick className="h-4 w-4" />
                    )}
                    <span className="text-[11px] font-bold uppercase tracking-wider">{metric.label}</span>
                  </div>
                  <p className="font-display text-3xl font-extrabold text-[#0d1117]">{metric.uniqueUsers}</p>
                  <p className="mt-1 text-xs font-medium text-[#6e6a8a]">unique users</p>
                  <p className="mt-3 text-sm font-semibold text-[#3b5bdb]">
                    {metric.totalClicks.toLocaleString()} total clicks
                  </p>
                </div>
              ))}
            </div>

            <div className="irp-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-[#6741d9]" />
                  <h2 className="font-display text-lg font-extrabold text-[#0d1117]">
                    Visitors{" "}
                    <span className="text-sm font-semibold text-[#6e6a8a]">
                      ({data.totalVisitors})
                    </span>
                  </h2>
                </div>
                <p className="text-xs text-[#6e6a8a]">
                  Every user who opened the dashboard and what they did
                </p>
              </div>

              {data.users.length === 0 ? (
                <p className="text-sm text-[#6e6a8a]">
                  No visitors recorded yet. User IDs will appear here as students open the dashboard.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgba(103,65,217,0.12)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                        <th className="px-2 py-2">Visitor</th>
                        {dailyColumns.map((col) => (
                          <th key={col.eventType} className="px-2 py-2 text-center">
                            {col.label}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center">Total</th>
                        <th className="px-2 py-2">Last active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((u) => (
                        <tr
                          key={u.academyUserId}
                          className="border-b border-[rgba(103,65,217,0.06)] align-top"
                        >
                          <td className="px-2 py-2.5">
                            <div className="font-semibold text-[#0d1117]">
                              {u.userName?.trim() || "Unnamed student"}
                            </div>
                            <button
                              type="button"
                              onClick={() => copyId(u.academyUserId)}
                              title={`Click to copy: ${u.academyUserId}`}
                              className="mt-0.5 font-mono text-[11px] text-[#6e6a8a] transition-colors hover:text-[#6741d9]"
                            >
                              {copiedId === u.academyUserId ? "Copied!" : u.academyUserId}
                            </button>
                          </td>
                          {dailyColumns.map((col) => {
                            const metric = u.metrics.find((m) => m.eventType === col.eventType);
                            const value = metric?.clicks ?? 0;
                            return (
                              <td
                                key={`${u.academyUserId}-${col.eventType}`}
                                className={`px-2 py-2.5 text-center ${
                                  value > 0 ? "font-semibold text-[#0d1117]" : "text-[#c2c0d6]"
                                }`}
                              >
                                {value}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2.5 text-center font-bold text-[#3b5bdb]">
                            {u.totalEvents}
                          </td>
                          <td className="px-2 py-2.5 text-[#6e6a8a]">{formatDate(u.lastSeen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="irp-card p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#6741d9]" />
                  <h2 className="font-display text-lg font-extrabold text-[#0d1117]">
                    Student Feedback{" "}
                    <span className="text-sm font-semibold text-[#6e6a8a]">
                      ({data.feedbackCount})
                    </span>
                  </h2>
                </div>
                {data.avgRating !== null && (
                  <div className="flex items-center gap-1.5 rounded-full border border-[rgba(103,65,217,0.15)] bg-[#f3f0ff] px-3 py-1">
                    <Star className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                    <span className="text-sm font-bold text-[#0d1117]">{data.avgRating.toFixed(1)}</span>
                    <span className="text-xs text-[#6e6a8a]">avg rating</span>
                  </div>
                )}
              </div>

              {data.feedbacks.length === 0 ? (
                <p className="text-sm text-[#6e6a8a]">
                  No feedback submitted yet. Responses will appear here as students rate the dashboard.
                </p>
              ) : (
                <div className="space-y-4">
                  {data.feedbacks.map((fb) => (
                    <div
                      key={fb.id}
                      className="rounded-xl border border-[rgba(103,65,217,0.10)] bg-[#faf9ff] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#0d1117]">
                              {fb.userName?.trim() || "Unnamed student"}
                            </span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                              {fb.ratingLabel}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-[#6e6a8a]">{fb.academyUserId}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-4 w-4 ${
                                  s <= fb.rating
                                    ? "fill-[#f59e0b] text-[#f59e0b]"
                                    : "fill-none text-[#d1d5db]"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-[#6e6a8a]">{formatDate(fb.submittedAt)}</span>
                        </div>
                      </div>
                      {fb.responses.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {fb.responses.map((qa, i) => (
                            <div key={i} className="rounded-lg bg-white p-3 border border-[rgba(103,65,217,0.08)]">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6741d9]/70">
                                {qa.question}
                              </p>
                              <p className="mt-1 text-sm text-[#0d1117]">{qa.answer}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="irp-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#6741d9]" />
                  <h2 className="font-display text-lg font-extrabold text-[#0d1117]">Daily breakdown</h2>
                </div>
                <p className="text-xs text-[#6e6a8a]">
                  Tracking since {formatDate(data.trackingSince)} · Updated {formatDate(data.generatedAt)}
                </p>
              </div>

              {data.daily.length === 0 ? (
                <p className="text-sm text-[#6e6a8a]">No events recorded yet. Stats will appear as students use the dashboard.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgba(103,65,217,0.12)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                        <th className="px-2 py-2">Date</th>
                        {dailyColumns.map((col) => (
                          <th key={col.eventType} className="px-2 py-2" colSpan={2}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                      <tr className="border-b border-[rgba(103,65,217,0.08)] text-[10px] font-semibold uppercase text-[#6e6a8a]">
                        <th className="px-2 py-1" />
                        {dailyColumns.flatMap((col) => [
                          <th key={`${col.eventType}-users-h`} className="px-2 py-1">Users</th>,
                          <th key={`${col.eventType}-clicks-h`} className="px-2 py-1">Clicks</th>,
                        ])}
                      </tr>
                    </thead>
                    <tbody>
                      {data.daily.map((row) => (
                        <tr key={row.date} className="border-b border-[rgba(103,65,217,0.06)]">
                          <td className="px-2 py-2 font-semibold text-[#0d1117]">{row.date}</td>
                          {dailyColumns.flatMap((col) => {
                            const metric = row.metrics.find((m) => m.eventType === col.eventType);
                            return [
                              <td key={`${row.date}-${col.eventType}-users`} className="px-2 py-2 text-[#0d1117]">
                                {metric?.users ?? 0}
                              </td>,
                              <td key={`${row.date}-${col.eventType}-clicks`} className="px-2 py-2 text-[#6e6a8a]">
                                {metric?.clicks ?? 0}
                              </td>,
                            ];
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
