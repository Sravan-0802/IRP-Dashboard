import { getAuthToken } from "@/lib/authToken";

export const DASHBOARD_ANALYTICS_EVENTS = {
  DASHBOARD_VISIT: "dashboard_visit",
  NAV_DASHBOARD: "nav_dashboard",
  NAV_ASSESSMENT_CALENDAR: "nav_assessment_calendar",
  FEEDBACK_OPEN: "feedback_open",
  CONTACT_US_CLICK: "contact_us_click",
} as const;

export type DashboardAnalyticsEvent =
  (typeof DASHBOARD_ANALYTICS_EVENTS)[keyof typeof DASHBOARD_ANALYTICS_EVENTS];

const VISIT_SESSION_KEY = "irp_dashboard_visit_logged";

/** Fire-and-forget event logging — never blocks UI or surfaces errors. */
export function trackDashboardEvent(eventType: DashboardAnalyticsEvent): void {
  const token = getAuthToken();
  void fetch("/api/student/analytics/event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ eventType }),
    keepalive: true,
  }).catch(() => {
    // Analytics must not affect the student experience.
  });
}

/** Log one dashboard visit per browser session. */
export function trackDashboardVisitOnce(): void {
  try {
    if (sessionStorage.getItem(VISIT_SESSION_KEY)) return;
    sessionStorage.setItem(VISIT_SESSION_KEY, "1");
  } catch {
    // sessionStorage unavailable — still attempt to log once this load.
  }
  trackDashboardEvent(DASHBOARD_ANALYTICS_EVENTS.DASHBOARD_VISIT);
}
