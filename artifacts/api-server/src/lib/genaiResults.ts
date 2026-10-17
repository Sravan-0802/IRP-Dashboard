import {
  db,
  academyUserGenaiAssessmentDetailsTable,
  academyUserGenaiNxtmockDetailsTable,
  type AcademyUserGenaiAssessmentDetails,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  fetchZGenaiAssessmentAttempts,
  fetchZGenaiNxtmockAttempts,
  type ZGenaiAssessmentRow,
  type ZGenaiNxtmockRow,
} from "./bigquery";
import {
  getGenaiQualificationRules,
  matchGenaiRule,
  type GenaiQualificationRule,
} from "./genaiQualificationRules";

export const GENAI_ASSESSMENT_DETAILS_KEY = "academy_user_genai_assessment_details";
export const GENAI_NXTMOCK_DETAILS_KEY = "academy_user_genai_nxtmock_details";

const BATCH_SIZE = 500;

const ENSURE_SQL = [
  `CREATE TABLE IF NOT EXISTS academy_user_genai_assessment_details (
    id serial PRIMARY KEY,
    user_id text NOT NULL,
    organisation_assessment_id text NOT NULL,
    assessment_tag text,
    assessment_title text,
    assessment_type text,
    assessment_number text,
    assessment_start_datetime timestamptz,
    user_assessment_start_datetime timestamptz,
    mcq_score real,
    mcq_max real,
    coding_score real,
    coding_max real,
    total_score real,
    total_max real,
    attempted integer NOT NULL DEFAULT 0,
    attempt_number integer,
    synced_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT academy_user_genai_assessment_unique UNIQUE (user_id, organisation_assessment_id)
  )`,
  `CREATE TABLE IF NOT EXISTS academy_user_genai_nxtmock_details (
    id serial PRIMARY KEY,
    user_id text NOT NULL,
    interview_id text NOT NULL,
    interview_tag text,
    interview_type text,
    interview_number text,
    attempt_start_datetime timestamptz,
    attempt_status text,
    average_rating real,
    overall_rating real,
    section_ratings text,
    attempt_number integer,
    synced_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT academy_user_genai_nxtmock_unique UNIQUE (user_id, interview_id)
  )`,
];

let ensurePromise: Promise<void> | null = null;

export async function ensureGenaiResultTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      for (const statement of ENSURE_SQL) await db.execute(sql.raw(statement));
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  await ensurePromise;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n == null ? null : Math.trunc(n);
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** BigQuery DATETIME (IST wall clock, no zone) → instant. */
function istDate(v: unknown): Date | null {
  const s = toStr(v);
  if (!s) return null;
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapAssessment(r: ZGenaiAssessmentRow) {
  return {
    userId: String(r.user_id),
    organisationAssessmentId: String(r.organisation_assessment_id),
    assessmentTag: toStr(r.assessment_specific_tag),
    assessmentTitle: toStr(r.assessment_title),
    assessmentType: toStr(r.assessment_type),
    assessmentNumber: toStr(r.assessment_number),
    assessmentStartDatetime: istDate(r.assessment_start_datetime),
    userAssessmentStartDatetime: istDate(r.user_assessment_start_datetime),
    mcqScore: toNum(r.mcq_score),
    mcqMax: toNum(r.mcq_max),
    codingScore: toNum(r.coding_score),
    codingMax: toNum(r.coding_max),
    totalScore: toNum(r.total_score),
    totalMax: toNum(r.total_max),
    attempted: r.attempted ? 1 : 0,
    attemptNumber: toInt(r.attempt_number),
    syncedAt: new Date(),
  };
}

function mapNxtmock(r: ZGenaiNxtmockRow) {
  return {
    userId: String(r.user_id),
    interviewId: String(r.interview_id),
    interviewTag: toStr(r.interview_tag),
    interviewType: toStr(r.interview_type),
    interviewNumber: toStr(r.interview_number),
    attemptStartDatetime: istDate(r.attempt_start_datetime),
    attemptStatus: toStr(r.attempt_status),
    averageRating: toNum(r.average_rating),
    overallRating: toNum(r.overall_rating),
    sectionRatings: toStr(r.section_ratings),
    attemptNumber: toInt(r.attempt_number),
    syncedAt: new Date(),
  };
}

export async function syncGenaiAssessmentAttempts(): Promise<number> {
  await ensureGenaiResultTables();
  const rows = await fetchZGenaiAssessmentAttempts();
  const mapped = rows
    .filter((r) => toStr(r.user_id) && toStr(r.organisation_assessment_id))
    .map(mapAssessment);
  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    await db
      .insert(academyUserGenaiAssessmentDetailsTable)
      .values(mapped.slice(i, i + BATCH_SIZE))
      .onConflictDoUpdate({
        target: [
          academyUserGenaiAssessmentDetailsTable.userId,
          academyUserGenaiAssessmentDetailsTable.organisationAssessmentId,
        ],
        set: {
          assessmentTag: sql`excluded.assessment_tag`,
          assessmentTitle: sql`excluded.assessment_title`,
          assessmentType: sql`excluded.assessment_type`,
          assessmentNumber: sql`excluded.assessment_number`,
          assessmentStartDatetime: sql`excluded.assessment_start_datetime`,
          userAssessmentStartDatetime: sql`excluded.user_assessment_start_datetime`,
          mcqScore: sql`excluded.mcq_score`,
          mcqMax: sql`excluded.mcq_max`,
          codingScore: sql`excluded.coding_score`,
          codingMax: sql`excluded.coding_max`,
          totalScore: sql`excluded.total_score`,
          totalMax: sql`excluded.total_max`,
          attempted: sql`excluded.attempted`,
          attemptNumber: sql`excluded.attempt_number`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return mapped.length;
}

export async function syncGenaiNxtmockAttempts(): Promise<number> {
  await ensureGenaiResultTables();
  const rows = await fetchZGenaiNxtmockAttempts();
  const mapped = rows
    .filter((r) => toStr(r.user_id) && toStr(r.interview_id))
    .map(mapNxtmock);
  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    await db
      .insert(academyUserGenaiNxtmockDetailsTable)
      .values(mapped.slice(i, i + BATCH_SIZE))
      .onConflictDoUpdate({
        target: [
          academyUserGenaiNxtmockDetailsTable.userId,
          academyUserGenaiNxtmockDetailsTable.interviewId,
        ],
        set: {
          interviewTag: sql`excluded.interview_tag`,
          interviewType: sql`excluded.interview_type`,
          interviewNumber: sql`excluded.interview_number`,
          attemptStartDatetime: sql`excluded.attempt_start_datetime`,
          attemptStatus: sql`excluded.attempt_status`,
          averageRating: sql`excluded.average_rating`,
          overallRating: sql`excluded.overall_rating`,
          sectionRatings: sql`excluded.section_ratings`,
          attemptNumber: sql`excluded.attempt_number`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return mapped.length;
}

export type GenaiAssessmentStatus =
  | "QUALIFIED"
  | "NOT_QUALIFIED"
  | "RESULT_PENDING"
  | "NOT_ATTEMPTED"
  | "UPCOMING";

export type GenaiAssessmentResult = {
  id: string;
  title: string;
  tag: string | null;
  number: string | null;
  startsAt: string | null;
  attemptedAt: string | null;
  status: GenaiAssessmentStatus;
  mcqScore: number | null;
  mcqMax: number | null;
  codingScore: number | null;
  codingMax: number | null;
  totalScore: number | null;
  totalMax: number | null;
};

export type GenaiInterviewResult = {
  id: string;
  tag: string | null;
  number: string | null;
  attemptedAt: string | null;
  status: "COMPLETED" | "NOT_ATTEMPTED";
  averageRating: number | null;
  sections: { key: string; label: string; rating: number | null }[];
};

const SECTION_LABELS: Record<string, string> = {
  GEN_AI: "GenAI",
  RESUME_DEEP_DIVE: "Resume deep dive",
  SELF_INTRO_TECHNICAL: "Self intro (technical)",
};

function sectionLabel(key: string): string {
  return (
    SECTION_LABELS[key] ??
    key
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ")
  );
}

export function genaiAssessmentStatus(
  row: Pick<
    AcademyUserGenaiAssessmentDetails,
    "attempted" | "assessmentStartDatetime" | "mcqScore" | "codingScore" | "assessmentTag" | "assessmentNumber"
  >,
  rules: GenaiQualificationRule[],
  now = new Date(),
): GenaiAssessmentStatus {
  if (row.attempted !== 1) {
    const start = row.assessmentStartDatetime;
    return start && start.getTime() > now.getTime() ? "UPCOMING" : "NOT_ATTEMPTED";
  }
  if (row.mcqScore == null && row.codingScore == null) return "RESULT_PENDING";
  const rule = matchGenaiRule([row.assessmentTag, row.assessmentNumber], rules);
  if (!rule) return "RESULT_PENDING";
  return (row.mcqScore ?? 0) >= rule.minMcq && (row.codingScore ?? 0) >= rule.minCoding
    ? "QUALIFIED"
    : "NOT_QUALIFIED";
}

function assessmentOrder(a: GenaiAssessmentResult): number {
  const n = Number(/(\d+)$/.exec(a.number ?? "")?.[1]);
  return Number.isFinite(n) ? n : 999;
}

function parseSections(raw: string | null): GenaiInterviewResult["sections"] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const row = item as { entity?: unknown; rating?: unknown };
        const key = typeof row.entity === "string" ? row.entity : "";
        return { key, label: sectionLabel(key), rating: toNum(row.rating) };
      })
      .filter((s) => s.key)
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
}

export async function getGenaiResultsForUser(userId: string): Promise<{
  assessments: GenaiAssessmentResult[];
  interviews: GenaiInterviewResult[];
}> {
  await ensureGenaiResultTables();
  const [rules, assessmentRows, interviewRows] = await Promise.all([
    getGenaiQualificationRules(),
    db
      .select()
      .from(academyUserGenaiAssessmentDetailsTable)
      .where(eq(academyUserGenaiAssessmentDetailsTable.userId, userId)),
    db
      .select()
      .from(academyUserGenaiNxtmockDetailsTable)
      .where(eq(academyUserGenaiNxtmockDetailsTable.userId, userId)),
  ]);
  const now = new Date();
  const assessments = assessmentRows
    .map((r): GenaiAssessmentResult => ({
      id: r.organisationAssessmentId,
      title: r.assessmentTitle ?? "GenAI Assessment",
      tag: r.assessmentTag,
      number: r.assessmentNumber,
      startsAt: r.assessmentStartDatetime?.toISOString() ?? null,
      attemptedAt: r.userAssessmentStartDatetime?.toISOString() ?? null,
      status: genaiAssessmentStatus(r, rules, now),
      mcqScore: r.mcqScore,
      mcqMax: r.mcqMax,
      codingScore: r.codingScore,
      codingMax: r.codingMax,
      totalScore: r.totalScore,
      totalMax: r.totalMax,
    }))
    .sort((a, b) => assessmentOrder(a) - assessmentOrder(b));
  const interviews = interviewRows
    .map((r): GenaiInterviewResult => ({
      id: r.interviewId,
      tag: r.interviewTag,
      number: r.interviewNumber,
      attemptedAt: r.attemptStartDatetime?.toISOString() ?? null,
      status: (r.attemptStatus ?? "").toUpperCase() === "COMPLETED" ? "COMPLETED" : "NOT_ATTEMPTED",
      averageRating: r.averageRating,
      sections: parseSections(r.sectionRatings),
    }))
    .sort((a, b) => (a.number ?? "").localeCompare(b.number ?? "", undefined, { numeric: true }));
  return { assessments, interviews };
}

/** Admin summary per tag: how many have access, attempted and qualified under the saved rules. */
export async function getGenaiAssessmentSummary(): Promise<
  { tag: string; total: number; attempted: number; qualified: number }[]
> {
  await ensureGenaiResultTables();
  const rules = await getGenaiQualificationRules();
  const rows = await db
    .select({
      assessmentTag: academyUserGenaiAssessmentDetailsTable.assessmentTag,
      assessmentNumber: academyUserGenaiAssessmentDetailsTable.assessmentNumber,
      attempted: academyUserGenaiAssessmentDetailsTable.attempted,
      assessmentStartDatetime: academyUserGenaiAssessmentDetailsTable.assessmentStartDatetime,
      mcqScore: academyUserGenaiAssessmentDetailsTable.mcqScore,
      codingScore: academyUserGenaiAssessmentDetailsTable.codingScore,
    })
    .from(academyUserGenaiAssessmentDetailsTable);
  const byTag = new Map<string, { tag: string; total: number; attempted: number; qualified: number }>();
  for (const row of rows) {
    const tag = row.assessmentTag ?? row.assessmentNumber ?? "Unknown";
    const entry = byTag.get(tag) ?? { tag, total: 0, attempted: 0, qualified: 0 };
    entry.total += 1;
    if (row.attempted === 1) entry.attempted += 1;
    if (genaiAssessmentStatus(row, rules) === "QUALIFIED") entry.qualified += 1;
    byTag.set(tag, entry);
  }
  return [...byTag.values()].sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }));
}
