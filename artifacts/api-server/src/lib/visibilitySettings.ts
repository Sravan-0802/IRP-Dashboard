import { db, visibilitySettingsTable, bigquerySyncStatusTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { loadStageCounts, type StageCounts } from "./stageCounts";

export const VISIBILITY_KEYS = [
  "online_l1_results",
  "fe_project_results",
  "ai_mock_results",
  "human_interview_results",
  "course_progress",
] as const;

export type VisibilityKey = (typeof VISIBILITY_KEYS)[number];

export type VisibilitySettingsMap = Record<VisibilityKey, boolean>;

export type SyncInfo = {
  tableName: string | null;
  status: string | null;
  rowCount: number | null;
  lastSyncedAt: string | null;
};

export type VisibilityStageCard = {
  key: VisibilityKey;
  camelKey:
    | "onlineL1Results"
    | "feProjectResults"
    | "aiMockResults"
    | "humanInterviewResults"
    | "courseProgress";
  label: string;
  description: string;
  visibleToStudents: boolean;
  awaitingApproval: boolean;
  sync: SyncInfo;
  counts: StageCounts | null;
};

export type VisibilitySettingsResponse = {
  onlineL1Results: boolean;
  feProjectResults: boolean;
  aiMockResults: boolean;
  humanInterviewResults: boolean;
  courseProgress: boolean;
  updatedAt: string | null;
  stages: VisibilityStageCard[];
};

/**
 * Defaults OFF for synced result stages — admin must approve release.
 * Course progress stays ON (not an exam-result release gate).
 */
const DEFAULT_VISIBLE: VisibilitySettingsMap = {
  online_l1_results: false,
  fe_project_results: false,
  ai_mock_results: false,
  human_interview_results: false,
  course_progress: true,
};

/** Which BigQuery sync table feeds each student-facing stage. */
const STAGE_SYNC_TABLE: Record<VisibilityKey, string | null> = {
  online_l1_results: "academy_user_assessment_details",
  fe_project_results: "academy_user_assessment_details",
  ai_mock_results: "academy_user_nxtmock_details",
  human_interview_results: null,
  course_progress: "academy_user_course_progress",
};

const STAGE_META: Record<
  VisibilityKey,
  {
    camelKey: VisibilityStageCard["camelKey"];
    label: string;
    description: string;
  }
> = {
  online_l1_results: {
    camelKey: "onlineL1Results",
    label: "Online L1 assessment results (July 12)",
    description:
      "12th July scores synced from BigQuery. Review cleared / not-cleared counts, then approve to show on student dashboards.",
  },
  fe_project_results: {
    camelKey: "feProjectResults",
    label: "FE Project results",
    description:
      "FE Project Main / Main II scores (C2 ≥18/20 cleared, Main II 100%). Uses the assessment sync table. Review counts below, then Release or Hide for student dashboards.",
  },
  ai_mock_results: {
    camelKey: "aiMockResults",
    label: "AI Mock Interview results",
    description:
      "NxtMock ratings synced from BigQuery. Review counts, then approve to show AI Mock results on dashboards.",
  },
  human_interview_results: {
    camelKey: "humanInterviewResults",
    label: "Human Interview stage",
    description:
      "Students currently in Human Interview journey state. Approve when you want them to see that next step.",
  },
  course_progress: {
    camelKey: "courseProgress",
    label: "Course progress",
    description: "Course completion stats from BigQuery. Approve to show Practice Hub progress.",
  },
};

export function toResponse(
  map: VisibilitySettingsMap,
  updatedAt: Date | null,
  syncByTable: Record<string, SyncInfo> = {},
  countsByKey: Partial<Record<VisibilityKey, StageCounts>> = {},
): VisibilitySettingsResponse {
  const stages: VisibilityStageCard[] = VISIBILITY_KEYS.map((key) => {
    const meta = STAGE_META[key];
    const table = STAGE_SYNC_TABLE[key];
    const sync = table
      ? (syncByTable[table] ?? {
          tableName: table,
          status: null,
          rowCount: null,
          lastSyncedAt: null,
        })
      : { tableName: null, status: null, rowCount: null, lastSyncedAt: null };
    const visibleToStudents = map[key];
    const counts = countsByKey[key] ?? null;
    const hasSyncedData =
      Boolean(sync.lastSyncedAt) ||
      key === "human_interview_results" ||
      (counts != null && counts.attempted > 0);
    return {
      key,
      camelKey: meta.camelKey,
      label: meta.label,
      description: meta.description,
      visibleToStudents,
      awaitingApproval: hasSyncedData && !visibleToStudents,
      sync,
      counts,
    };
  });

  return {
    onlineL1Results: map.online_l1_results,
    feProjectResults: map.fe_project_results,
    aiMockResults: map.ai_mock_results,
    humanInterviewResults: map.human_interview_results,
    courseProgress: map.course_progress,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
    stages,
  };
}

export async function ensureVisibilityDefaults(): Promise<void> {
  const existing = await db
    .select({ key: visibilitySettingsTable.key })
    .from(visibilitySettingsTable)
    .where(inArray(visibilitySettingsTable.key, [...VISIBILITY_KEYS]));
  const have = new Set(existing.map((r) => r.key));
  const missing = VISIBILITY_KEYS.filter((k) => !have.has(k));
  if (missing.length === 0) return;

  const now = new Date();
  await db
    .insert(visibilitySettingsTable)
    .values(
      missing.map((key) => ({
        key,
        visible: DEFAULT_VISIBLE[key] ? 1 : 0,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();
}

async function loadSyncByTable(): Promise<Record<string, SyncInfo>> {
  const tables = [
    ...new Set(Object.values(STAGE_SYNC_TABLE).filter((t): t is string => Boolean(t))),
  ];
  if (tables.length === 0) return {};
  const rows = await db
    .select()
    .from(bigquerySyncStatusTable)
    .where(inArray(bigquerySyncStatusTable.tableName, tables));
  const out: Record<string, SyncInfo> = {};
  for (const row of rows) {
    out[row.tableName] = {
      tableName: row.tableName,
      status: row.status,
      rowCount: row.rowCount,
      lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    };
  }
  return out;
}

export async function getVisibilitySettings(options?: {
  includeCounts?: boolean;
}): Promise<{
  map: VisibilitySettingsMap;
  updatedAt: Date | null;
  syncByTable: Record<string, SyncInfo>;
  countsByKey: Partial<Record<VisibilityKey, StageCounts>>;
}> {
  await ensureVisibilityDefaults();
  const includeCounts = options?.includeCounts === true;

  const [rows, syncByTable, countsByKey] = await Promise.all([
    db
      .select()
      .from(visibilitySettingsTable)
      .where(inArray(visibilitySettingsTable.key, [...VISIBILITY_KEYS])),
    loadSyncByTable(),
    includeCounts ? loadStageCounts() : Promise.resolve({}),
  ]);

  const map: VisibilitySettingsMap = { ...DEFAULT_VISIBLE };
  let updatedAt: Date | null = null;
  for (const row of rows) {
    if ((VISIBILITY_KEYS as readonly string[]).includes(row.key)) {
      map[row.key as VisibilityKey] = row.visible === 1;
      if (!updatedAt || row.updatedAt > updatedAt) updatedAt = row.updatedAt;
    }
  }
  return { map, updatedAt, syncByTable, countsByKey };
}

export async function updateVisibilitySettings(
  partial: Partial<VisibilitySettingsMap>,
): Promise<{
  map: VisibilitySettingsMap;
  updatedAt: Date | null;
  syncByTable: Record<string, SyncInfo>;
  countsByKey: Partial<Record<VisibilityKey, StageCounts>>;
}> {
  await ensureVisibilityDefaults();
  const now = new Date();
  const entries = (Object.entries(partial) as [VisibilityKey, boolean][]).filter(
    ([key]) => (VISIBILITY_KEYS as readonly string[]).includes(key),
  );

  for (const [key, visible] of entries) {
    await db
      .insert(visibilitySettingsTable)
      .values({ key, visible: visible ? 1 : 0, updatedAt: now })
      .onConflictDoUpdate({
        target: visibilitySettingsTable.key,
        set: { visible: visible ? 1 : 0, updatedAt: now },
      });
  }

  return getVisibilitySettings({ includeCounts: true });
}

/** Snake_case keys accepted from admin PUT body. */
export function parseAdminSettingsBody(
  raw: unknown,
): Partial<VisibilitySettingsMap> | null {
  if (!raw || typeof raw !== "object") return null;
  const settings = (raw as { settings?: unknown }).settings ?? raw;
  if (!settings || typeof settings !== "object") return null;

  const out: Partial<VisibilitySettingsMap> = {};
  const obj = settings as Record<string, unknown>;

  const aliases: Record<string, VisibilityKey> = {
    online_l1_results: "online_l1_results",
    onlineL1Results: "online_l1_results",
    fe_project_results: "fe_project_results",
    feProjectResults: "fe_project_results",
    ai_mock_results: "ai_mock_results",
    aiMockResults: "ai_mock_results",
    human_interview_results: "human_interview_results",
    humanInterviewResults: "human_interview_results",
    course_progress: "course_progress",
    courseProgress: "course_progress",
  };

  for (const [k, v] of Object.entries(obj)) {
    const key = aliases[k];
    if (!key || typeof v !== "boolean") continue;
    out[key] = v;
  }

  return Object.keys(out).length > 0 ? out : null;
}
