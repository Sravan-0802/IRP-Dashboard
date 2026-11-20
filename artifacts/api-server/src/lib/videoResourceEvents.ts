import { db, videoResourceEventsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

export const VIDEO_RESOURCE_EVENT_TYPES = [
  "page_open",
  "filter_change",
  "watch_click",
  "play",
  "pause",
  "progress",
  "ended",
  "close",
  "mentorship_open",
] as const;

export type VideoResourceEventType = (typeof VIDEO_RESOURCE_EVENT_TYPES)[number];

const EVENT_TYPE_SET = new Set<string>(VIDEO_RESOURCE_EVENT_TYPES);

export function isVideoResourceEventType(value: string): value is VideoResourceEventType {
  return EVENT_TYPE_SET.has(value);
}

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS video_resource_events (
  id serial PRIMARY KEY,
  academy_user_id text NOT NULL,
  student_id integer REFERENCES students(id),
  resource_id text,
  event_type text NOT NULL,
  watch_seconds integer,
  duration_seconds integer,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_resource_events_user_idx
  ON video_resource_events (academy_user_id);
CREATE INDEX IF NOT EXISTS video_resource_events_type_time_idx
  ON video_resource_events (event_type, created_at);
CREATE INDEX IF NOT EXISTS video_resource_events_session_idx
  ON video_resource_events (session_id);
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureVideoResourceEventsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = db
      .execute(sql.raw(ENSURE_SQL))
      .then(() => undefined)
      .catch((err) => {
        ensurePromise = null;
        throw err;
      });
  }
  await ensurePromise;
}

export type InsertVideoResourceEvent = {
  academyUserId: string;
  studentId?: number | null;
  resourceId?: string | null;
  eventType: VideoResourceEventType;
  watchSeconds?: number | null;
  durationSeconds?: number | null;
  sessionId?: string | null;
};

export async function insertVideoResourceEvent(
  values: InsertVideoResourceEvent,
): Promise<void> {
  await ensureVideoResourceEventsTable();
  await db.insert(videoResourceEventsTable).values({
    academyUserId: values.academyUserId,
    studentId: values.studentId ?? null,
    resourceId: values.resourceId ?? null,
    eventType: values.eventType,
    watchSeconds: values.watchSeconds ?? null,
    durationSeconds: values.durationSeconds ?? null,
    sessionId: values.sessionId ?? null,
  });
}
