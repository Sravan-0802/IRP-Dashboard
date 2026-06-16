import { Router } from "express";
import { db, dashboardAnalyticsEventsTable } from "@workspace/db";
import { sql, count, countDistinct, inArray } from "drizzle-orm";
import { checkApiKey } from "../lib/apiKey";

const router = Router();

const EVENT_LABELS: Record<string, string> = {
  dashboard_visit: "Users who visited the dashboard",
  nav_dashboard: "Dashboard nav clicks",
  nav_assessment_calendar: "Assessment Calendar clicks",
  feedback_open: "Feedback opens",
  contact_us_click: "Help & Support clicks",
};

const TRACKED_EVENTS = Object.keys(EVENT_LABELS);

// GET /api/analytics/dashboard — aggregate stats (admin API key required)
router.get("/analytics/dashboard", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const summaryRows = await db
      .select({
        eventType: dashboardAnalyticsEventsTable.eventType,
        totalClicks: count(),
        uniqueUsers: countDistinct(dashboardAnalyticsEventsTable.academyUserId),
      })
      .from(dashboardAnalyticsEventsTable)
      .where(inArray(dashboardAnalyticsEventsTable.eventType, TRACKED_EVENTS))
      .groupBy(dashboardAnalyticsEventsTable.eventType);

    const summaryByType = new Map(summaryRows.map((r) => [r.eventType, r]));

    const events = TRACKED_EVENTS.map((eventType) => {
      const row = summaryByType.get(eventType);
      return {
        eventType,
        label: EVENT_LABELS[eventType] ?? eventType,
        totalClicks: Number(row?.totalClicks ?? 0),
        uniqueUsers: Number(row?.uniqueUsers ?? 0),
      };
    });

    const eventList = sql.join(
      TRACKED_EVENTS.map((eventType) => sql`${eventType}`),
      sql`, `,
    );

    const dailyRows = await db.execute<{ day: string; event_type: string; clicks: string; users: string }>(sql`
      SELECT
        to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
        event_type,
        COUNT(*)::text AS clicks,
        COUNT(DISTINCT academy_user_id)::text AS users
      FROM dashboard_analytics_events
      WHERE event_type IN (${eventList})
      GROUP BY 1, 2
      ORDER BY 1 DESC, 2
      LIMIT 500
    `);

    const dailyMap = new Map<string, Record<string, { clicks: number; users: number }>>();
    for (const row of dailyRows.rows) {
      const day = row.day;
      if (!dailyMap.has(day)) dailyMap.set(day, {});
      dailyMap.get(day)![row.event_type] = {
        clicks: Number(row.clicks),
        users: Number(row.users),
      };
    }

    const daily = [...dailyMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, counts]) => ({
        date,
        metrics: TRACKED_EVENTS.map((eventType) => ({
          eventType,
          clicks: counts[eventType]?.clicks ?? 0,
          users: counts[eventType]?.users ?? 0,
        })),
      }));

    const [firstEvent] = await db
      .select({ createdAt: dashboardAnalyticsEventsTable.createdAt })
      .from(dashboardAnalyticsEventsTable)
      .orderBy(dashboardAnalyticsEventsTable.createdAt)
      .limit(1);

    res.json({
      trackingSince: firstEvent?.createdAt?.toISOString() ?? null,
      generatedAt: new Date().toISOString(),
      events,
      daily,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load dashboard analytics");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
