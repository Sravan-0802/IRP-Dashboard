import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Gauge, Loader2, RefreshCw } from "lucide-react";

type CapacityMetrics = {
  generatedAt: string;
  dau: { avg30: number; peak30: number; peakDay: string | null; today: number };
  mau: { month: string; users: number; events: number }[];
  wau: { weekStart: string; users: number; events: number }[];
  everVisited: number;
  eligibleStudents: number;
  totalStudents: number;
  busiestHour: { hour: string; events: number; users: number } | null;
  peakMinute: { minute: string; events: number; users: number } | null;
  visitsPerDay30: number;
  eventsPerDay30: number;
  storage: {
    databaseBytes: number;
    tables: { name: string; bytes: number; rows: number }[];
    analyticsEventsPerMonth: number;
  };
  estimates: {
    requestsPerVisit: number;
    requestsPerDay: number;
    avgQps: number;
    peakQps: number;
    bandwidthGbPerDay: number;
    peakBandwidthMbPerSec: number;
    examDay: { students: number; burstQps: number; sustainedQps: number; burstMbPerSec: number };
  };
  assumptions: {
    apiCallsPerPageLoad: number;
    pollingCallsPerMinute: number;
    sessionMinutes: number;
    pageWeightMb: number;
    examDayConcurrentStudents: number;
  };
};

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${fmt(bytes / 1024 ** 3, 2)} GB`;
  if (bytes >= 1024 ** 2) return `${fmt(bytes / 1024 ** 2, 0)} MB`;
  return `${fmt(bytes / 1024, 0)} KB`;
}

function fmtMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtWeek(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return weekStart;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

function Metric({
  label,
  value,
  detail,
  estimate,
  children,
}: {
  label: string;
  value: string;
  detail: string;
  estimate?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[rgba(103,65,217,0.12)] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#6741d9]">{label}</p>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            estimate ? "bg-amber-50 text-amber-700" : "bg-[#e8faf0] text-[#067647]"
          }`}
        >
          {estimate ? "Estimate" : "Measured"}
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold text-[#0d1117]">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#6e6a8a]">{detail}</p>
      {children}
    </div>
  );
}

function ActivityTable({
  title,
  firstColumn,
  rows,
}: {
  title: string;
  firstColumn: string;
  rows: { key: string; label: string; users: number; events: number; partial?: boolean }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-extrabold text-[#0d1117]">{title}</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[rgba(103,65,217,0.12)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
              <th className="py-2 pr-3">{firstColumn}</th>
              <th className="py-2 pr-3">Users</th>
              <th className="py-2">Events</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-[rgba(103,65,217,0.06)]">
                <td className="py-2 pr-3 font-medium text-[#0d1117]">
                  {r.label}
                  {r.partial ? <span className="ml-1.5 text-[11px] font-semibold text-[#6e6a8a]">so far</span> : null}
                </td>
                <td className="py-2 pr-3 text-[#344054]">{fmt(r.users)}</td>
                <td className="py-2 text-[#344054]">{fmt(r.events)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CapacityMetricsPanel({ apiKey }: { apiKey: string }) {
  const [data, setData] = useState<CapacityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analytics/capacity", { headers: { "x-api-key": apiKey.trim() } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Could not load usage metrics");
      setData(body as CapacityMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load usage metrics");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const fullMonths = data && data.mau.length > 2 ? data.mau.slice(1, -1) : (data?.mau ?? []);
  const latestFull = fullMonths[fullMonths.length - 1];
  const reach = data && data.eligibleStudents > 0 ? (data.everVisited / data.eligibleStudents) * 100 : 0;
  const headroom = data && data.everVisited > 0 ? data.eligibleStudents / data.everVisited : 0;
  const dauMau = data && latestFull?.users ? (data.dau.avg30 / latestFull.users) * 100 : 0;
  const topTable = data?.storage.tables[0];
  const fullWeeks = data && data.wau.length > 1 ? data.wau.slice(0, -1) : [];
  const lastFullWeek = fullWeeks[fullWeeks.length - 1];
  const thisWeek = data?.wau[data.wau.length - 1];
  const avgWau = fullWeeks.length ? fullWeeks.reduce((sum, w) => sum + w.users, 0) / fullWeeks.length : 0;
  const dauWau = lastFullWeek?.users && data ? (data.dau.avg30 / lastFullWeek.users) * 100 : 0;

  return (
    <section className="irp-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[#6741d9]" />
          <h2 className="font-display text-lg font-extrabold text-[#0d1117]">Usage & capacity</h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {!data && loading ? <p className="text-sm text-[#6e6a8a]">Loading usage metrics</p> : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Metric
              label="DAU · Daily active users"
              value={`${fmt(data.dau.avg30)} avg`}
              detail={`Last 30 full days. Peak ${fmt(data.dau.peak30)}${data.dau.peakDay ? ` on ${data.dau.peakDay}` : ""}. Today so far ${fmt(data.dau.today)}.`}
            />
            <Metric
              label="WAU · Weekly active users"
              value={lastFullWeek ? fmt(lastFullWeek.users) : "-"}
              detail={`${lastFullWeek ? `Week of ${fmtWeek(lastFullWeek.weekStart)} (Mon to Sun). ` : ""}Average ${fmt(avgWau)} over the last ${fullWeeks.length} full weeks. This week so far ${fmt(thisWeek?.users ?? 0)}. DAU/WAU ${fmt(dauWau, 0)}%.`}
            />
            <Metric
              label="MAU · Monthly active users"
              value={latestFull ? fmt(latestFull.users) : "-"}
              detail={`${latestFull ? `${fmtMonth(latestFull.month)}. ` : ""}DAU/MAU ${fmt(dauMau, 0)}%. ${fmt(data.everVisited)} students have ever visited, ${fmt(reach, 0)}% of ${fmt(data.eligibleStudents)} IRP-eligible (${fmt(headroom, 1)}× headroom).`}
            >
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.mau.map((m, i) => (
                  <span key={m.month} className="rounded-md bg-[#f3f0ff] px-2 py-0.5 text-[11px] text-[#475467]">
                    {fmtMonth(m.month)} <b className="text-[#0d1117]">{fmt(m.users)}</b>
                    {i === data.mau.length - 1 ? " so far" : ""}
                  </span>
                ))}
              </div>
            </Metric>
            <Metric
              label="QPS · Requests per second"
              value={`${fmt(data.estimates.avgQps, 2)} avg · ${fmt(data.estimates.peakQps, 0)} peak`}
              detail={`About ${fmt(data.estimates.requestsPerVisit)} requests per visit, ${fmt(data.estimates.requestsPerDay)} a day. Peak from the busiest minute${data.peakMinute ? ` (${data.peakMinute.minute} IST, ${fmt(data.peakMinute.users)} students at once)` : ""}.`}
              estimate
            />
            <Metric
              label="Data storage"
              value={fmtBytes(data.storage.databaseBytes)}
              detail={`Whole database.${topTable ? ` Largest table ${topTable.name} (${fmtBytes(topTable.bytes)}).` : ""} Visit tracking adds about ${fmt(data.storage.analyticsEventsPerMonth)} events a month.`}
            />
            <Metric
              label="Bandwidth"
              value={`${fmt(data.estimates.bandwidthGbPerDay, 2)} GB/day`}
              detail={`About ${fmt(data.visitsPerDay30)} dashboard visits a day at about ${data.assumptions.pageWeightMb} MB each. Peak about ${fmt(data.estimates.peakBandwidthMbPerSec, 1)} MB/s.`}
              estimate
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ActivityTable
              title="Monthly active users"
              firstColumn="Month"
              rows={data.mau.map((m, i) => ({
                key: m.month,
                label: fmtMonth(m.month),
                users: m.users,
                events: m.events,
                partial: i === data.mau.length - 1,
              }))}
            />
            <ActivityTable
              title="Weekly active users (last 12 weeks)"
              firstColumn="Week of"
              rows={data.wau.map((w, i) => ({
                key: w.weekStart,
                label: fmtWeek(w.weekStart),
                users: w.users,
                events: w.events,
                partial: i === data.wau.length - 1,
              }))}
            />
          </div>

          <div>
            <div className="space-y-3">
              <div className="rounded-xl bg-[#f8f7ff] p-4">
                <h3 className="text-sm font-extrabold text-[#0d1117]">
                  Exam-day planning: {fmt(data.estimates.examDay.students)} students in the same minute
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-[#344054]">
                  <li>
                    Page-load burst: about <b>{fmt(data.estimates.examDay.burstQps)} requests per second</b>
                  </li>
                  <li>
                    While tabs stay open: about <b>{fmt(data.estimates.examDay.sustainedQps)} requests per second</b>
                  </li>
                  <li>
                    Bandwidth in that first minute: about <b>{fmt(data.estimates.examDay.burstMbPerSec)} MB/s</b>
                  </li>
                </ul>
              </div>
              {data.busiestHour ? (
                <p className="text-xs text-[#6e6a8a]">
                  Busiest hour in the last 30 days: {data.busiestHour.hour} IST, {fmt(data.busiestHour.events)} events
                  from {fmt(data.busiestHour.users)} students.
                </p>
              ) : null}
              <p className="text-xs leading-relaxed text-[#6e6a8a]">
                Estimates assume {data.assumptions.apiCallsPerPageLoad} API calls per page load,{" "}
                {data.assumptions.pollingCallsPerMinute} background update checks a minute while a tab is open, a{" "}
                {data.assumptions.sessionMinutes}-minute visit, and about {data.assumptions.pageWeightMb} MB per page
                load. Measured numbers come from dashboard visit tracking and the database itself.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
