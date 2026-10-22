import { db } from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";

/**
 * Estimate inputs. Requests and bandwidth are not logged per call, so they are derived from
 * tracked visits. Polling matches useVisibilitySettings (15s) + useStudentAccess (30s).
 */
export const CAPACITY_ASSUMPTIONS = {
  apiCallsPerPageLoad: 12,
  pollingCallsPerMinute: 6,
  sessionMinutes: 5,
  pageWeightMb: 1,
  examDayConcurrentStudents: 3000,
} as const;

type Row = Record<string, unknown>;

async function rows(query: SQL): Promise<Row[]> {
  const result = await db.execute(query);
  return ((result as { rows?: Row[] }).rows ?? []) as Row[];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type CapacityMetrics = {
  generatedAt: string;
  dau: { avg30: number; peak30: number; peakDay: string | null; today: number };
  mau: { month: string; users: number; events: number }[];
  /** Weeks start Monday (IST). Latest entry is the current, partial week. */
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
  assumptions: typeof CAPACITY_ASSUMPTIONS;
};

export async function getCapacityMetrics(): Promise<CapacityMetrics> {
  const ist = sql.raw(`AT TIME ZONE 'Asia/Kolkata'`);
  const [daily, today, monthly, weekly, totals, students, hour, minute, dbSize, tables] = await Promise.all([
    rows(sql`
      WITH d AS (
        SELECT to_char(created_at ${ist}, 'YYYY-MM-DD') AS d,
          COUNT(DISTINCT academy_user_id) AS dau,
          COUNT(*) AS events,
          COUNT(*) FILTER (WHERE event_type = 'dashboard_visit') AS visits
        FROM dashboard_analytics_events
        WHERE created_at > now() - interval '30 days'
          AND (created_at ${ist})::date < (now() ${ist})::date
        GROUP BY 1
      )
      SELECT ROUND(AVG(dau)) AS avg_dau, ROUND(AVG(events)) AS avg_events, ROUND(AVG(visits)) AS avg_visits,
        (SELECT dau FROM d ORDER BY dau DESC LIMIT 1) AS peak_dau,
        (SELECT d FROM d ORDER BY dau DESC LIMIT 1) AS peak_day
      FROM d`),
    rows(sql`
      SELECT COUNT(DISTINCT academy_user_id) AS dau FROM dashboard_analytics_events
      WHERE (created_at ${ist})::date = (now() ${ist})::date`),
    rows(sql`
      SELECT to_char(created_at ${ist}, 'YYYY-MM') AS mon,
        COUNT(DISTINCT academy_user_id) AS users, COUNT(*) AS events
      FROM dashboard_analytics_events GROUP BY 1 ORDER BY 1`),
    rows(sql`
      SELECT to_char(date_trunc('week', created_at ${ist}), 'YYYY-MM-DD') AS wk,
        COUNT(DISTINCT academy_user_id) AS users, COUNT(*) AS events
      FROM dashboard_analytics_events
      WHERE created_at ${ist} >= date_trunc('week', now() ${ist}) - interval '11 weeks'
      GROUP BY 1 ORDER BY 1`),
    rows(sql`SELECT COUNT(DISTINCT academy_user_id) AS users FROM dashboard_analytics_events`),
    rows(sql`
      SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE UPPER(COALESCE(irp_eligible_status, '')) = 'ELIGIBLE') AS eligible
      FROM academy_user_basic_details`),
    rows(sql`
      SELECT to_char(date_trunc('hour', created_at ${ist}), 'YYYY-MM-DD HH24:00') AS hr,
        COUNT(*) AS events, COUNT(DISTINCT academy_user_id) AS users
      FROM dashboard_analytics_events WHERE created_at > now() - interval '30 days'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1`),
    rows(sql`
      SELECT to_char(date_trunc('minute', created_at ${ist}), 'YYYY-MM-DD HH24:MI') AS mi,
        COUNT(*) AS events, COUNT(DISTINCT academy_user_id) AS users
      FROM dashboard_analytics_events GROUP BY 1 ORDER BY 3 DESC, 2 DESC LIMIT 1`),
    rows(sql`SELECT pg_database_size(current_database()) AS bytes`),
    rows(sql`
      SELECT relname AS name, pg_total_relation_size(relid) AS bytes, n_live_tup AS est_rows
      FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 6`),
  ]);

  const d = daily[0] ?? {};
  const mau = monthly.map((r) => ({ month: String(r.mon), users: num(r.users), events: num(r.events) }));
  const fullMonths = mau.length > 2 ? mau.slice(1, -1) : mau;
  const analyticsEventsPerMonth = fullMonths.length
    ? Math.round(fullMonths.reduce((s, m) => s + m.events, 0) / fullMonths.length)
    : 0;

  const a = CAPACITY_ASSUMPTIONS;
  const requestsPerVisit = a.apiCallsPerPageLoad + a.pollingCallsPerMinute * a.sessionMinutes;
  const visitsPerDay30 = num(d.avg_visits);
  const requestsPerDay = visitsPerDay30 * requestsPerVisit;
  const peakUsers = num(minute[0]?.users);
  const firstMinuteCalls = a.apiCallsPerPageLoad + a.pollingCallsPerMinute;

  return {
    generatedAt: new Date().toISOString(),
    dau: {
      avg30: num(d.avg_dau),
      peak30: num(d.peak_dau),
      peakDay: d.peak_day ? String(d.peak_day) : null,
      today: num(today[0]?.dau),
    },
    mau,
    wau: weekly.map((r) => ({ weekStart: String(r.wk), users: num(r.users), events: num(r.events) })),
    everVisited: num(totals[0]?.users),
    eligibleStudents: num(students[0]?.eligible),
    totalStudents: num(students[0]?.total),
    busiestHour: hour[0]
      ? { hour: String(hour[0].hr), events: num(hour[0].events), users: num(hour[0].users) }
      : null,
    peakMinute: minute[0]
      ? { minute: String(minute[0].mi), events: num(minute[0].events), users: peakUsers }
      : null,
    visitsPerDay30,
    eventsPerDay30: num(d.avg_events),
    storage: {
      databaseBytes: num(dbSize[0]?.bytes),
      tables: tables.map((t) => ({ name: String(t.name), bytes: num(t.bytes), rows: num(t.est_rows) })),
      analyticsEventsPerMonth,
    },
    estimates: {
      requestsPerVisit,
      requestsPerDay: Math.round(requestsPerDay),
      avgQps: requestsPerDay / 86_400,
      peakQps: (peakUsers * firstMinuteCalls) / 60,
      bandwidthGbPerDay: (visitsPerDay30 * a.pageWeightMb) / 1024,
      peakBandwidthMbPerSec: (peakUsers * a.pageWeightMb) / 60,
      examDay: {
        students: a.examDayConcurrentStudents,
        burstQps: (a.examDayConcurrentStudents * a.apiCallsPerPageLoad) / 60,
        sustainedQps: (a.examDayConcurrentStudents * a.pollingCallsPerMinute) / 60,
        burstMbPerSec: (a.examDayConcurrentStudents * a.pageWeightMb) / 60,
      },
    },
    assumptions: a,
  };
}
