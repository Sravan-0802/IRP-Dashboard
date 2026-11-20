import { getAuthToken } from "@/lib/authToken";

export const VIDEO_RESOURCE_EVENTS = {
  PAGE_OPEN: "page_open",
  FILTER_CHANGE: "filter_change",
  WATCH_CLICK: "watch_click",
  PLAY: "play",
  PAUSE: "pause",
  PROGRESS: "progress",
  ENDED: "ended",
  CLOSE: "close",
  MENTORSHIP_OPEN: "mentorship_open",
} as const;

export type VideoResourceEvent =
  (typeof VIDEO_RESOURCE_EVENTS)[keyof typeof VIDEO_RESOURCE_EVENTS];

export type TrackVideoResourceEventInput = {
  eventType: VideoResourceEvent;
  resourceId?: string | null;
  watchSeconds?: number | null;
  durationSeconds?: number | null;
  sessionId?: string | null;
};

/** One browser session id for stitching Video Resources events. */
export function createVideoResourceSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `vr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Fire-and-forget Video Resources metrics — never blocks UI. */
export function trackVideoResourceEvent(input: TrackVideoResourceEventInput): void {
  const token = getAuthToken();
  void fetch("/api/student/video-resource-events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      eventType: input.eventType,
      resourceId: input.resourceId ?? undefined,
      watchSeconds: input.watchSeconds ?? undefined,
      durationSeconds: input.durationSeconds ?? undefined,
      sessionId: input.sessionId ?? undefined,
    }),
    keepalive: true,
  }).catch(() => {
    // Analytics must not affect the student experience.
  });
}
