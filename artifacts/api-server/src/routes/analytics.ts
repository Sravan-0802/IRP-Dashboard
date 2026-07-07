import { Router } from "express";
import { db, dashboardAnalyticsEventsTable, academyUserBasicDetailsTable, dashboardFeedbackTable, contactUsMessagesTable, l1CycleRegistrationsTable } from "@workspace/db";
import { sql, count, countDistinct, inArray, min, max, desc } from "drizzle-orm";
import { checkApiKey } from "../lib/apiKey";
import { rowToL1RegistrationResponse } from "../lib/l1Registration";

const router = Router();

const EVENT_LABELS: Record<string, string> = {
  dashboard_visit: "Users who visited the dashboard",
  nav_dashboard: "Dashboard nav clicks",
  nav_assessments_hub: "Assessments Hub clicks",
  nav_assessment_calendar: "Assessment Calendar clicks",
  feedback_open: "Feedback opens",
  contact_us_click: "Help & Support clicks",
  mock_assessment_link_click: "Mock assessment link clicks",
  main_assessment_link_click: "Main assessment link clicks",
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

    // Per-user breakdown: who came, and what they did.
    const perUserRows = await db
      .select({
        academyUserId: dashboardAnalyticsEventsTable.academyUserId,
        eventType: dashboardAnalyticsEventsTable.eventType,
        clicks: count(),
        firstSeen: min(dashboardAnalyticsEventsTable.createdAt),
        lastSeen: max(dashboardAnalyticsEventsTable.createdAt),
      })
      .from(dashboardAnalyticsEventsTable)
      .where(inArray(dashboardAnalyticsEventsTable.eventType, TRACKED_EVENTS))
      .groupBy(
        dashboardAnalyticsEventsTable.academyUserId,
        dashboardAnalyticsEventsTable.eventType,
      );

    const userIds = [...new Set(perUserRows.map((r) => r.academyUserId))];
    const nameRows = userIds.length
      ? await db
          .select({
            userId: academyUserBasicDetailsTable.userId,
            userName: academyUserBasicDetailsTable.userName,
          })
          .from(academyUserBasicDetailsTable)
          .where(inArray(academyUserBasicDetailsTable.userId, userIds))
      : [];
    const nameMap = new Map(nameRows.map((r) => [r.userId, r.userName]));

    const toIso = (v: unknown): string | null =>
      v ? new Date(v as string | Date).toISOString() : null;

    type PerUser = {
      academyUserId: string;
      userName: string | null;
      totalEvents: number;
      firstSeen: string | null;
      lastSeen: string | null;
      counts: Record<string, number>;
    };
    const usersMap = new Map<string, PerUser>();
    for (const row of perUserRows) {
      let u = usersMap.get(row.academyUserId);
      if (!u) {
        u = {
          academyUserId: row.academyUserId,
          userName: nameMap.get(row.academyUserId) ?? null,
          totalEvents: 0,
          firstSeen: null,
          lastSeen: null,
          counts: {},
        };
        usersMap.set(row.academyUserId, u);
      }
      const clicks = Number(row.clicks ?? 0);
      u.counts[row.eventType] = clicks;
      u.totalEvents += clicks;
      const fs = toIso(row.firstSeen);
      const ls = toIso(row.lastSeen);
      if (fs && (!u.firstSeen || fs < u.firstSeen)) u.firstSeen = fs;
      if (ls && (!u.lastSeen || ls > u.lastSeen)) u.lastSeen = ls;
    }

    const users = [...usersMap.values()]
      .map((u) => ({
        academyUserId: u.academyUserId,
        userName: u.userName,
        totalEvents: u.totalEvents,
        firstSeen: u.firstSeen,
        lastSeen: u.lastSeen,
        metrics: TRACKED_EVENTS.map((eventType) => ({
          eventType,
          clicks: u.counts[eventType] ?? 0,
        })),
      }))
      .sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));

    // Feedback submissions with user names joined.
    type FeedbackRow = {
      id: string;
      academy_user_id: string;
      user_name: string | null;
      rating: string;
      rating_label: string;
      responses: string;
      created_at: string;
    };
    const feedbackResult = await db.execute<FeedbackRow>(sql`
      SELECT
        f.id::text,
        f.academy_user_id,
        b.user_name,
        f.rating::text,
        f.rating_label,
        f.responses,
        f.created_at
      FROM dashboard_feedback f
      LEFT JOIN academy_user_basic_details b ON b.user_id = f.academy_user_id
      ORDER BY f.created_at DESC
      LIMIT 200
    `);

    type FeedbackQA = { question: string; answer: string };
    const feedbacks = feedbackResult.rows.map((r) => {
      let responses: FeedbackQA[] = [];
      try {
        responses = JSON.parse(r.responses) as FeedbackQA[];
      } catch {
        // malformed JSON — skip responses
      }
      return {
        id: r.id,
        academyUserId: r.academy_user_id,
        userName: r.user_name ?? null,
        rating: Number(r.rating),
        ratingLabel: r.rating_label,
        responses,
        submittedAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      };
    });

    const avgRating =
      feedbacks.length > 0
        ? Math.round((feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length) * 10) / 10
        : null;

    // Help & Support messages.
    const contactRows = await db
      .select({
        id: contactUsMessagesTable.id,
        academyUserId: contactUsMessagesTable.academyUserId,
        userName: contactUsMessagesTable.userName,
        message: contactUsMessagesTable.message,
        createdAt: contactUsMessagesTable.createdAt,
      })
      .from(contactUsMessagesTable)
      .orderBy(desc(contactUsMessagesTable.createdAt))
      .limit(200);

    const contactMessages = [...contactRows]
      .sort((a, b) =>
        (b.createdAt?.toISOString() ?? "").localeCompare(a.createdAt?.toISOString() ?? ""),
      )
      .map((r) => ({
        id: String(r.id),
        academyUserId: r.academyUserId,
        userName: r.userName ?? null,
        message: r.message,
        submittedAt: r.createdAt ? r.createdAt.toISOString() : null,
      }));

    const registrationRows = await db
      .select()
      .from(l1CycleRegistrationsTable)
      .orderBy(desc(l1CycleRegistrationsTable.submittedAt))
      .limit(20000);

    const l1Registrations = registrationRows.map((r) => rowToL1RegistrationResponse(r));

    const [registrationTotal] = await db
      .select({ n: count() })
      .from(l1CycleRegistrationsTable);
    const l1RegistrationCount = Number(registrationTotal?.n ?? l1Registrations.length);

    const [firstEvent] = await db
      .select({ createdAt: dashboardAnalyticsEventsTable.createdAt })
      .from(dashboardAnalyticsEventsTable)
      .orderBy(dashboardAnalyticsEventsTable.createdAt)
      .limit(1);

    res.json({
      trackingSince: firstEvent?.createdAt?.toISOString() ?? null,
      generatedAt: new Date().toISOString(),
      totalVisitors: users.length,
      events,
      daily,
      users,
      feedbacks,
      feedbackCount: feedbacks.length,
      avgRating,
      contactMessages,
      contactMessageCount: contactMessages.length,
      l1Registrations,
      l1RegistrationCount,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load dashboard analytics");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
