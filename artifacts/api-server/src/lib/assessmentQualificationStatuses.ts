import {
  db,
  academyUserAssessmentDetailsTable,
  irpAssessmentQualificationStatusesTable,
} from "@workspace/db";
import { and, eq, notInArray, or, sql } from "drizzle-orm";
import {
  DASHBOARD_ACCESS_OVERRIDE_ID,
  MANUAL_DASHBOARD_ACCESS_GRANT_ID,
  MANUAL_DASHBOARD_ACCESS_REVOKE_ID,
} from "./academyUserProfile";
import { feAssessmentIndex, getFeAssessmentStatus } from "./feQualification";
import {
  DEFAULT_FE_QUALIFICATION_RULES,
  parseFeQualificationRules,
  type FeQualificationRule,
} from "./feQualificationRules";
import {
  DEFAULT_L1_QUALIFICATION_RULES,
  parseL1QualificationRules,
  type L1QualificationRule,
} from "./l1QualificationRules";
import { isMockAssessmentFields } from "./mainOnly";

type AssessmentRow = {
  userId: string;
  assessmentTag: string | null;
  assessmentTitle: string | null;
  level: string | null;
  cycle: string | null;
  userAssessmentStartDatetime: Date | null;
  attemptNumber: number | null;
  mcqUserSectionScore: number | null;
  mcqSectionMaxScore: number | null;
  codingUserSectionScore: number | null;
  codingSectionMaxScore: number | null;
  feUserSectionScore: number | null;
  feSectionMaxScore: number | null;
  assessmentUserScore: number | null;
  assessmentTotalScore: number | null;
  syncedAt: Date;
};

type QualificationStatusRow = typeof irpAssessmentQualificationStatusesTable.$inferInsert;

function assessmentFamily(row: Pick<AssessmentRow, "level" | "assessmentTag" | "assessmentTitle">) {
  const tag = (row.assessmentTag ?? "").toUpperCase();
  const title = (row.assessmentTitle ?? "").toUpperCase();
  const level = (row.level ?? "").toUpperCase();

  if (tag.includes("HUSTLER") || title.includes("HUSTLER")) return "L1_HUSTLER";
  if (
    level.includes("FE-PROJECT") ||
    level.includes("FE_PROJECT") ||
    tag.includes("FE-PROJECT") ||
    tag.includes("FE_PROJECT") ||
    title.includes("FE PROJECT") ||
    title.includes("FE-PROJECT") ||
    (title.includes("MAIN II") && (title.includes("IRP") || title.includes("PROJECT")))
  ) {
    return "FE_PROJECT";
  }
  return null;
}

function assessmentSpecificTag(family: string, identifiers: Array<string | null>) {
  const number = identifiers.map(feAssessmentIndex).find((value) => value != null);
  if (number != null) return `${family}_A${number}`;

  const cycleNumber = identifiers
    .map((identifier) => identifier?.toUpperCase().match(/(?:^|[_\s-])C(\d+)\b/)?.[1])
    .find((value) => value != null);
  return cycleNumber == null ? family : `${family}_C${cycleNumber}`;
}

function timestamp(value: Date | null | undefined): number {
  return value instanceof Date ? value.getTime() : -1;
}

function isLaterAttempt(candidate: AssessmentRow, previous: AssessmentRow): boolean {
  const candidateStart = timestamp(candidate.userAssessmentStartDatetime);
  const previousStart = timestamp(previous.userAssessmentStartDatetime);
  if (candidateStart !== previousStart) return candidateStart > previousStart;

  const candidateAttempt = candidate.attemptNumber ?? -1;
  const previousAttempt = previous.attemptNumber ?? -1;
  if (candidateAttempt !== previousAttempt) return candidateAttempt > previousAttempt;

  return timestamp(candidate.syncedAt) > timestamp(previous.syncedAt);
}

async function loadSavedQualificationRules(): Promise<{
  feRules: FeQualificationRule[];
  l1Rules: L1QualificationRule[];
}> {
  const existsResult = await db.execute(sql`
    SELECT
      to_regclass('public.fe_qualification_rules') IS NOT NULL AS fe_exists,
      to_regclass('public.l1_qualification_rules') IS NOT NULL AS l1_exists
  `);
  const exists = (existsResult as { rows?: Array<{ fe_exists?: boolean; l1_exists?: boolean }> }).rows?.[0];

  const [feResult, l1Result] = await Promise.all([
    exists?.fe_exists
      ? db.execute(sql`SELECT payload FROM fe_qualification_rules WHERE id = 1 LIMIT 1`)
      : Promise.resolve(null),
    exists?.l1_exists
      ? db.execute(sql`SELECT payload FROM l1_qualification_rules WHERE id = 1 LIMIT 1`)
      : Promise.resolve(null),
  ]);
  const fePayload = (feResult as { rows?: Array<{ payload?: string }> } | null)?.rows?.[0]?.payload;
  const l1Payload = (l1Result as { rows?: Array<{ payload?: string }> } | null)?.rows?.[0]?.payload;

  let feRules = DEFAULT_FE_QUALIFICATION_RULES;
  let l1Rules = DEFAULT_L1_QUALIFICATION_RULES;
  try {
    if (fePayload) feRules = parseFeQualificationRules(JSON.parse(fePayload)) ?? feRules;
  } catch {
    // Keep the default FE rules if persisted JSON is invalid.
  }
  try {
    if (l1Payload) l1Rules = parseL1QualificationRules(JSON.parse(l1Payload)) ?? l1Rules;
  } catch {
    // Keep the default L1 rules if persisted JSON is invalid.
  }
  return { feRules, l1Rules };
}

/**
 * Rebuilds the compact all-assessment table from the Postgres mirror.
 * The unique row is per user, normalized assessment tag, and title; repeated
 * attempts update that row using the most recent attempt.
 */
export async function refreshAssessmentQualificationStatuses(): Promise<void> {
  const { feRules, l1Rules } = await loadSavedQualificationRules();

  const rows = (await db
    .select({
      userId: academyUserAssessmentDetailsTable.userId,
      assessmentTag: academyUserAssessmentDetailsTable.assessmentTag,
      assessmentTitle: academyUserAssessmentDetailsTable.assessmentTitle,
      level: academyUserAssessmentDetailsTable.level,
      cycle: academyUserAssessmentDetailsTable.cycle,
      userAssessmentStartDatetime: academyUserAssessmentDetailsTable.userAssessmentStartDatetime,
      attemptNumber: academyUserAssessmentDetailsTable.attemptNumber,
      mcqUserSectionScore: academyUserAssessmentDetailsTable.mcqUserSectionScore,
      mcqSectionMaxScore: academyUserAssessmentDetailsTable.mcqSectionMaxScore,
      codingUserSectionScore: academyUserAssessmentDetailsTable.codingUserSectionScore,
      codingSectionMaxScore: academyUserAssessmentDetailsTable.codingSectionMaxScore,
      feUserSectionScore: academyUserAssessmentDetailsTable.feUserSectionScore,
      feSectionMaxScore: academyUserAssessmentDetailsTable.feSectionMaxScore,
      assessmentUserScore: academyUserAssessmentDetailsTable.assessmentUserScore,
      assessmentTotalScore: academyUserAssessmentDetailsTable.assessmentTotalScore,
      syncedAt: academyUserAssessmentDetailsTable.syncedAt,
    })
    .from(academyUserAssessmentDetailsTable)
    .where(
      notInArray(academyUserAssessmentDetailsTable.organisationAssessmentId, [
        MANUAL_DASHBOARD_ACCESS_GRANT_ID,
        MANUAL_DASHBOARD_ACCESS_REVOKE_ID,
        DASHBOARD_ACCESS_OVERRIDE_ID,
      ]),
    )) as AssessmentRow[];

  const latestRows = new Map<string, { source: AssessmentRow; result: QualificationStatusRow }>();
  const supersededFamilyRows = new Map<
    string,
    { userId: string; assessmentSpecificTag: string; assessmentTitle: string }
  >();
  for (const row of rows) {
    const family = assessmentFamily(row);
    if (!family || isMockAssessmentFields({ tag: row.assessmentTag, title: row.assessmentTitle })) continue;

    const title = row.assessmentTitle?.trim() || "Untitled assessment";
    const identifiers = [row.cycle, row.assessmentTag, row.assessmentTitle];
    const specificTag = assessmentSpecificTag(family, identifiers);
    if (specificTag.startsWith(`${family}_C`)) {
      const obsoleteKey = JSON.stringify([row.userId, family, title]);
      supersededFamilyRows.set(obsoleteKey, {
        userId: row.userId,
        assessmentSpecificTag: family,
        assessmentTitle: title,
      });
    }
    const score =
      row.assessmentUserScore ??
      ((row.mcqUserSectionScore ?? 0) +
        (row.codingUserSectionScore ?? 0) +
        (row.feUserSectionScore ?? 0));
    const maximum =
      row.assessmentTotalScore ??
      ((row.mcqSectionMaxScore ?? 0) +
        (row.codingSectionMaxScore ?? 0) +
        (row.feSectionMaxScore ?? 0));
    const scorePercentage = maximum > 0 ? (score / maximum) * 100 : null;
    const rules = family === "L1_HUSTLER" ? l1Rules : feRules;
    const qualificationStatus = getFeAssessmentStatus(
      identifiers,
      scorePercentage,
      row.userAssessmentStartDatetime,
      rules,
    );
    const result: QualificationStatusRow = {
      userId: row.userId,
      assessmentSpecificTag: specificTag,
      assessmentTitle: title,
      qualificationStatus,
    };
    const key = JSON.stringify([row.userId, specificTag, title]);
    const previous = latestRows.get(key);
    if (!previous || isLaterAttempt(row, previous.source)) {
      latestRows.set(key, { source: row, result });
    }
  }

  const values = [...latestRows.values()].map(({ result }) => result);
  for (let index = 0; index < values.length; index += 500) {
    const batch = values.slice(index, index + 500);
    await db
      .insert(irpAssessmentQualificationStatusesTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          irpAssessmentQualificationStatusesTable.userId,
          irpAssessmentQualificationStatusesTable.assessmentSpecificTag,
          irpAssessmentQualificationStatusesTable.assessmentTitle,
        ],
        set: {
          qualificationStatus: sql`excluded.qualification_status`,
        },
      });
  }

  const obsoleteRows = [...supersededFamilyRows.values()];
  for (let index = 0; index < obsoleteRows.length; index += 200) {
    const batch = obsoleteRows.slice(index, index + 200);
    await db
      .delete(irpAssessmentQualificationStatusesTable)
      .where(
        or(
          ...batch.map((row) =>
            and(
              eq(irpAssessmentQualificationStatusesTable.userId, row.userId),
              eq(irpAssessmentQualificationStatusesTable.assessmentSpecificTag, row.assessmentSpecificTag),
              eq(irpAssessmentQualificationStatusesTable.assessmentTitle, row.assessmentTitle),
            ),
          ),
        ),
      );
  }
}
