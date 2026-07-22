import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type VisibilityKey =
  | "online_l1_results"
  | "fe_project_results"
  | "ai_mock_results"
  | "human_interview_results"
  | "course_progress";

/** Same org assessment id the student UI uses for 12th July 2026. */
export const L1_JULY12_ORG_ASSESSMENT_ID = "248f8108292246cb9fd7af5edd025a9a";

export type StageCounts = {
  /** Short label for what these counts refer to. */
  scope: string;
  attempted: number;
  cleared: number;
  notCleared: number;
  /** Extra breakdown when useful (e.g. assigned but not attempted). */
  assigned?: number;
  registeredNotAttempted?: number;
  inStage?: number;
};

const FE_PRED = sql`(
  UPPER(COALESCE(level, '')) LIKE '%FE-PROJECT%'
  OR UPPER(COALESCE(level, '')) LIKE '%FE_PROJECT%'
  OR UPPER(COALESCE(assessment_tag, '')) LIKE '%FE-PROJECT%'
  OR UPPER(COALESCE(assessment_title, '')) LIKE '%FE PROJECT%'
)`;

const ONLINE_PRED = sql`NOT ${FE_PRED}`;

const ATTEMPTED_PRED = sql`(
  assessment_user_score IS NOT NULL
  OR mcq_user_section_score IS NOT NULL
  OR coding_user_section_score IS NOT NULL
)`;

const WRITTEN_SCORE_PRED = sql`(
  COALESCE(assessment_user_score, 0) > 0
  OR COALESCE(mcq_user_section_score, 0) > 0
  OR COALESCE(coding_user_section_score, 0) > 0
)`;

type CountRow = {
  attempted?: string | number | null;
  cleared?: string | number | null;
  not_cleared?: string | number | null;
  assigned?: string | number | null;
  registered_not_attempted?: string | number | null;
  in_stage?: string | number | null;
};

function n(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

function firstRow(result: { rows?: CountRow[] } | CountRow[]): CountRow {
  if (Array.isArray(result)) return (result[0] ?? {}) as CountRow;
  return (result.rows?.[0] ?? {}) as CountRow;
}

async function july12OnlineCounts(): Promise<StageCounts> {
  const result = await db.execute(sql`
    WITH per_user AS (
      SELECT
        user_id,
        MAX(CASE WHEN ${ATTEMPTED_PRED} THEN 1 ELSE 0 END) AS attempted,
        MAX(
          CASE
            WHEN assessment_total_score > 0
              AND assessment_user_score >= assessment_total_score * 0.7
            THEN 1 ELSE 0
          END
        ) AS cleared
      FROM academy_user_assessment_details
      WHERE organisation_assessment_id = ${L1_JULY12_ORG_ASSESSMENT_ID}
        AND ${ONLINE_PRED}
      GROUP BY user_id
    )
    SELECT
      COUNT(*) FILTER (WHERE attempted = 1)::int AS attempted,
      COUNT(*) FILTER (WHERE cleared = 1)::int AS cleared,
      COUNT(*) FILTER (WHERE attempted = 1 AND cleared = 0)::int AS not_cleared
    FROM per_user
  `);
  const row = firstRow(result as { rows?: CountRow[] } | CountRow[]);
  return {
    scope: "12th July 2026 online assessment",
    attempted: n(row.attempted),
    cleared: n(row.cleared),
    notCleared: n(row.not_cleared),
  };
}

async function feProjectCounts(): Promise<StageCounts> {
  const result = await db.execute(sql`
    WITH per_user AS (
      SELECT
        user_id,
        1 AS assigned,
        MAX(CASE WHEN ${WRITTEN_SCORE_PRED} THEN 1 ELSE 0 END) AS attempted,
        MAX(
          CASE
            WHEN assessment_total_score > 0
              AND assessment_user_score >= assessment_total_score
            THEN 1 ELSE 0
          END
        ) AS cleared
      FROM academy_user_assessment_details
      WHERE ${FE_PRED}
      GROUP BY user_id
    )
    SELECT
      COUNT(*)::int AS assigned,
      COUNT(*) FILTER (WHERE attempted = 1)::int AS attempted,
      COUNT(*) FILTER (WHERE cleared = 1)::int AS cleared,
      COUNT(*) FILTER (WHERE attempted = 1 AND cleared = 0)::int AS not_cleared,
      COUNT(*) FILTER (WHERE attempted = 0)::int AS registered_not_attempted
    FROM per_user
  `);
  const row = firstRow(result as { rows?: CountRow[] } | CountRow[]);
  return {
    scope: "FE Project (Main / Main II)",
    assigned: n(row.assigned),
    attempted: n(row.attempted),
    cleared: n(row.cleared),
    notCleared: n(row.not_cleared),
    registeredNotAttempted: n(row.registered_not_attempted),
  };
}

async function aiMockCounts(): Promise<StageCounts> {
  const result = await db.execute(sql`
    WITH best AS (
      SELECT DISTINCT ON (user_id)
        user_id,
        average_rating
      FROM academy_user_nxtmock_details
      ORDER BY user_id, average_rating DESC NULLS LAST, synced_at DESC NULLS LAST
    )
    SELECT
      COUNT(*)::int AS attempted,
      COUNT(*) FILTER (WHERE average_rating IS NOT NULL AND average_rating >= 5)::int AS cleared,
      COUNT(*) FILTER (
        WHERE average_rating IS NULL OR average_rating < 5
      )::int AS not_cleared
    FROM best
  `);
  const row = firstRow(result as { rows?: CountRow[] } | CountRow[]);
  return {
    scope: "AI Mock Interview (NxtMock)",
    attempted: n(row.attempted),
    cleared: n(row.cleared),
    notCleared: n(row.not_cleared),
  };
}

async function humanInterviewCounts(): Promise<StageCounts> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE journey_state = 'L1_HUMAN_INTERVIEW')::int AS in_stage,
      COUNT(*) FILTER (WHERE journey_state = 'L1_HUMAN_INTERVIEW')::int AS attempted,
      0::int AS cleared,
      COUNT(*) FILTER (WHERE journey_state = 'L1_HUMAN_INTERVIEW')::int AS not_cleared
    FROM students
  `);
  const row = firstRow(result as { rows?: CountRow[] } | CountRow[]);
  const inStage = n(row.in_stage);
  return {
    scope: "Human Interview (journey state)",
    attempted: inStage,
    cleared: 0,
    notCleared: inStage,
    inStage,
  };
}

async function courseProgressCounts(): Promise<StageCounts> {
  const result = await db.execute(sql`
    WITH per_user AS (
      SELECT
        user_id,
        MAX(COALESCE(overall_completion_pct, 0)) AS best_pct
      FROM academy_user_course_progress
      GROUP BY user_id
    )
    SELECT
      COUNT(*)::int AS attempted,
      COUNT(*) FILTER (WHERE best_pct >= 100)::int AS cleared,
      COUNT(*) FILTER (WHERE best_pct < 100)::int AS not_cleared
    FROM per_user
  `);
  const row = firstRow(result as { rows?: CountRow[] } | CountRow[]);
  return {
    scope: "Course progress (any course)",
    attempted: n(row.attempted),
    cleared: n(row.cleared),
    notCleared: n(row.not_cleared),
  };
}

export async function loadStageCounts(): Promise<Record<VisibilityKey, StageCounts>> {
  const [onlineL1, fe, aiMock, human, course] = await Promise.all([
    july12OnlineCounts(),
    feProjectCounts(),
    aiMockCounts(),
    humanInterviewCounts(),
    courseProgressCounts(),
  ]);

  return {
    online_l1_results: onlineL1,
    fe_project_results: fe,
    ai_mock_results: aiMock,
    human_interview_results: human,
    course_progress: course,
  };
}
