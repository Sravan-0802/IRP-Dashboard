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
  /** Manual toggle stored in DB. */
  visibleToStudents: boolean;
  /** Scheduled release ISO datetime, if set. */
  releaseAt: string | null;
  /** visible OR now >= releaseAt — what students actually see. */
  effectiveVisible: boolean;
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
 * Defaults OFF for synced result stages unless explicitly released.
 * AI Mock results and course progress stay ON by default.
 */
const DEFAULT_VISIBLE: VisibilitySettingsMap = {
  online_l1_results: false,
  fe_project_results: false,
  ai_mock_results: true,
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
    label: "Online L1 assessment results",
    description:
      "Latest online L1 scores synced from BigQuery (incl. IRP 2.0 z_*). Review counts, then Release now or schedule a release time.",
  },
  fe_project_results: {
    camelKey: "feProjectResults",
    label: "FE Project results (≥18/20)",
    description:
      "Latest FE Project scores from BigQuery (≥18/20 clears). Review counts, then Release now or schedule.",
  },
  ai_mock_results: {
    camelKey: "aiMockResults",
    label: "AI Mock Interview results",
    description:
      "Latest NxtMock ratings synced from BigQuery. Review counts, then Release now or schedule.",
  },
  human_interview_results: {
    camelKey: "humanInterviewResults",
    label: "Human Interview stage",
    description:
      "Students currently in Human Interview journey state. Release when you want them to see that next step.",
  },
  course_progress: {
    camelKey: "courseProgress",
    label: "Course progress",
    description:
      "Latest course completion stats from BigQuery. Release to show Practice Hub progress.",
  },
};

export function isEffectivelyVisible(
  visible: boolean,
  releaseAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (visible) return true;
  if (releaseAt != null && !Number.isNaN(releaseAt.getTime()) && now >= releaseAt) return true;
  return false;
}

type RowState = {
  visible: boolean;
  releaseAt: Date | null;
};

export function toResponse(
  map: VisibilitySettingsMap,
  releaseAtByKey: Partial<Record<VisibilityKey, Date | null>>,
  updatedAt: Date | null,
  syncByTable: Record<string, SyncInfo> = {},
  countsByKey: Partial<Record<VisibilityKey, StageCounts>> = {},
  now: Date = new Date(),
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
    const releaseAt = releaseAtByKey[key] ?? null;
    const effectiveVisible = isEffectivelyVisible(visibleToStudents, releaseAt, now);
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
      releaseAt: releaseAt ? releaseAt.toISOString() : null,
      effectiveVisible,
      awaitingApproval: hasSyncedData && !effectiveVisible,
      sync,
      counts,
    };
  });

  return {
    // Student-facing flags use effective visibility (manual OR scheduled).
    onlineL1Results: isEffectivelyVisible(
      map.online_l1_results,
      releaseAtByKey.online_l1_results ?? null,
      now,
    ),
    feProjectResults: isEffectivelyVisible(
      map.fe_project_results,
      releaseAtByKey.fe_project_results ?? null,
      now,
    ),
    aiMockResults: isEffectivelyVisible(
      map.ai_mock_results,
      releaseAtByKey.ai_mock_results ?? null,
      now,
    ),
    humanInterviewResults: isEffectivelyVisible(
      map.human_interview_results,
      releaseAtByKey.human_interview_results ?? null,
      now,
    ),
    courseProgress: isEffectivelyVisible(
      map.course_progress,
      releaseAtByKey.course_progress ?? null,
      now,
    ),
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
        releaseAt: null,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();
}

async function loadSyncByTable(): Promise<Record<string, SyncInfo>> {
  const tables = [
    ...new Set(
      [
        ...Object.values(STAGE_SYNC_TABLE).filter((t): t is string => Boolean(t)),
        "irp_l1_round_wise_summary",
      ],
    ),
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
  releaseAtByKey: Partial<Record<VisibilityKey, Date | null>>;
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
  const releaseAtByKey: Partial<Record<VisibilityKey, Date | null>> = {};
  let updatedAt: Date | null = null;
  for (const row of rows) {
    if ((VISIBILITY_KEYS as readonly string[]).includes(row.key)) {
      const key = row.key as VisibilityKey;
      map[key] = row.visible === 1;
      releaseAtByKey[key] = row.releaseAt ?? null;
      if (!updatedAt || row.updatedAt > updatedAt) updatedAt = row.updatedAt;
    }
  }
  return { map, releaseAtByKey, updatedAt, syncByTable, countsByKey };
}

export type VisibilityUpdatePartial = {
  visible?: Partial<VisibilitySettingsMap>;
  /** ISO string, Date, or null to clear schedule. Omitted keys unchanged. */
  releaseAt?: Partial<Record<VisibilityKey, string | Date | null>>;
};

export async function updateVisibilitySettings(
  partial: VisibilityUpdatePartial,
): Promise<{
  map: VisibilitySettingsMap;
  releaseAtByKey: Partial<Record<VisibilityKey, Date | null>>;
  updatedAt: Date | null;
  syncByTable: Record<string, SyncInfo>;
  countsByKey: Partial<Record<VisibilityKey, StageCounts>>;
}> {
  await ensureVisibilityDefaults();
  const now = new Date();
  const visibleEntries = (Object.entries(partial.visible ?? {}) as [VisibilityKey, boolean][]).filter(
    ([key]) => (VISIBILITY_KEYS as readonly string[]).includes(key),
  );
  const releaseEntries = (
    Object.entries(partial.releaseAt ?? {}) as [VisibilityKey, string | Date | null][]
  ).filter(([key]) => (VISIBILITY_KEYS as readonly string[]).includes(key));

  const keysTouched = new Set<VisibilityKey>([
    ...visibleEntries.map(([k]) => k),
    ...releaseEntries.map(([k]) => k),
  ]);

  for (const key of keysTouched) {
    const visibleEntry = visibleEntries.find(([k]) => k === key);
    const releaseEntry = releaseEntries.find(([k]) => k === key);

    let releaseAtValue: Date | null | undefined = undefined;
    if (releaseEntry) {
      const raw = releaseEntry[1];
      if (raw === null) releaseAtValue = null;
      else if (raw instanceof Date) releaseAtValue = Number.isNaN(raw.getTime()) ? null : raw;
      else {
        const d = new Date(String(raw));
        releaseAtValue = Number.isNaN(d.getTime()) ? null : d;
      }
    }

    // Release now → visible=true clears schedule unless a new releaseAt is also sent.
    // Hide → visible=false clears schedule unless a future releaseAt is also sent.
    if (visibleEntry && releaseAtValue === undefined) {
      if (visibleEntry[1] === true || visibleEntry[1] === false) {
        releaseAtValue = null;
      }
    }

    const set: { visible?: number; releaseAt?: Date | null; updatedAt: Date } = {
      updatedAt: now,
    };
    if (visibleEntry) set.visible = visibleEntry[1] ? 1 : 0;
    if (releaseAtValue !== undefined) set.releaseAt = releaseAtValue;

    const insertVisible =
      visibleEntry != null ? (visibleEntry[1] ? 1 : 0) : DEFAULT_VISIBLE[key] ? 1 : 0;
    const insertReleaseAt = releaseAtValue !== undefined ? releaseAtValue : null;

    await db
      .insert(visibilitySettingsTable)
      .values({
        key,
        visible: insertVisible,
        releaseAt: insertReleaseAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: visibilitySettingsTable.key,
        set,
      });
  }

  return getVisibilitySettings({ includeCounts: true });
}

/** Snake_case / camelCase keys accepted from admin PUT body. */
export function parseAdminSettingsBody(raw: unknown): VisibilityUpdatePartial | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const settings = (root.settings ?? raw) as Record<string, unknown>;
  if (!settings || typeof settings !== "object") return null;

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

  const visible: Partial<VisibilitySettingsMap> = {};
  for (const [k, v] of Object.entries(settings)) {
    const key = aliases[k];
    if (!key || typeof v !== "boolean") continue;
    visible[key] = v;
  }

  const releaseAt: Partial<Record<VisibilityKey, string | Date | null>> = {};
  const releaseRoot =
    (root.releaseAt as Record<string, unknown> | undefined) ??
    (root.release_at as Record<string, unknown> | undefined) ??
    (settings.releaseAt as Record<string, unknown> | undefined) ??
    (settings.release_at as Record<string, unknown> | undefined);

  if (releaseRoot && typeof releaseRoot === "object") {
    for (const [k, v] of Object.entries(releaseRoot)) {
      const key = aliases[k];
      if (!key) continue;
      if (v === null) releaseAt[key] = null;
      else if (typeof v === "string") releaseAt[key] = v;
    }
  }

  // Also accept flat `onlineL1ResultsReleaseAt` style
  for (const [k, v] of Object.entries(settings)) {
    const m = /^(onlineL1Results|feProjectResults|aiMockResults|humanInterviewResults|courseProgress)ReleaseAt$/.exec(
      k,
    );
    if (!m) continue;
    const key = aliases[m[1]];
    if (!key) continue;
    if (v === null) releaseAt[key] = null;
    else if (typeof v === "string") releaseAt[key] = v;
  }

  if (Object.keys(visible).length === 0 && Object.keys(releaseAt).length === 0) return null;
  return { visible, releaseAt };
}
