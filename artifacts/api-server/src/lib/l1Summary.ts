import { db, academyUserAssessmentDetailsTable, irpL1AssessmentStatusesTable } from "@workspace/db";
import { notInArray, sql } from "drizzle-orm";
import { MANUAL_DASHBOARD_ACCESS_GRANT_ID, MANUAL_DASHBOARD_ACCESS_REVOKE_ID } from "./academyUserProfile";
import { feAssessmentIndex, getFeAssessmentStatus, requiredFePercentage } from "./feQualification";
import { getL1QualificationRules } from "./l1QualificationRules";
import { isMockAssessmentFields } from "./mainOnly";

export type L1TagSummary = { tag: string; total: number; attempted: number; qualified: number };

const L1_MAIN_TAG_PREFIX = "ACADEMY-IRP-2.0_MAIN_L1_HUSTLER-ASSESSMENT_A";

function isL1Row(tag: string | null, title: string | null): boolean {
  const t = (tag ?? "").toUpperCase();
  const ti = (title ?? "").toUpperCase();
  // "IRP 2.0 L1 Hustler Assessment[ II]" and its MOCK variants are the only rows
  // carrying "HUSTLER" in the tag or title; FE Project rows never do.
  return t.includes("HUSTLER") || ti.includes("HUSTLER");
}

/**
 * Distinct students per L1 (Hustler) MAIN assessment, scored with the saved L1 rules.
 * Bare-numeric tags (`A1`, `A2`, ...) and the `_C1`/`_C2` variants fall back to cycle/title
 * for the assessment number, same as the FE summary.
 */
export async function getL1AssessmentSummary(): Promise<L1TagSummary[]> {
  const rules = await getL1QualificationRules();
  const rows = await db
    .select({
      userId: academyUserAssessmentDetailsTable.userId,
      organisationAssessmentId: academyUserAssessmentDetailsTable.organisationAssessmentId,
      assessmentTag: academyUserAssessmentDetailsTable.assessmentTag,
      assessmentTitle: academyUserAssessmentDetailsTable.assessmentTitle,
      cycle: academyUserAssessmentDetailsTable.cycle,
      attemptNumber: academyUserAssessmentDetailsTable.attemptNumber,
      userAssessmentStartDatetime: academyUserAssessmentDetailsTable.userAssessmentStartDatetime,
      mcqUserSectionScore: academyUserAssessmentDetailsTable.mcqUserSectionScore,
      mcqSectionMaxScore: academyUserAssessmentDetailsTable.mcqSectionMaxScore,
      codingUserSectionScore: academyUserAssessmentDetailsTable.codingUserSectionScore,
      codingSectionMaxScore: academyUserAssessmentDetailsTable.codingSectionMaxScore,
      feUserSectionScore: academyUserAssessmentDetailsTable.feUserSectionScore,
      feSectionMaxScore: academyUserAssessmentDetailsTable.feSectionMaxScore,
      assessmentUserScore: academyUserAssessmentDetailsTable.assessmentUserScore,
      assessmentTotalScore: academyUserAssessmentDetailsTable.assessmentTotalScore,
      assessmentStatus: academyUserAssessmentDetailsTable.assessmentStatus,
    })
    .from(academyUserAssessmentDetailsTable)
    .where(
      notInArray(academyUserAssessmentDetailsTable.organisationAssessmentId, [
        MANUAL_DASHBOARD_ACCESS_GRANT_ID,
        MANUAL_DASHBOARD_ACCESS_REVOKE_ID,
      ]),
    );

  const buckets = new Map<
    string,
    { tag: string; order: number; total: Set<string>; attempted: Set<string>; qualified: Set<string> }
  >();
  const statusRows: Array<typeof irpL1AssessmentStatusesTable.$inferInsert> = [];
  for (const r of rows) {
    if (!isL1Row(r.assessmentTag, r.assessmentTitle)) continue;
    if (isMockAssessmentFields({ tag: r.assessmentTag, title: r.assessmentTitle })) continue;

    const identifiers = [r.cycle, r.assessmentTag, r.assessmentTitle];
    const n = identifiers.map(feAssessmentIndex).find((v) => v != null) ?? null;
    const tag = n != null ? `${L1_MAIN_TAG_PREFIX}${n}` : (r.assessmentTag ?? r.cycle ?? "Unknown");
    const bucket = buckets.get(tag) ?? {
      tag,
      order: n ?? 1000,
      total: new Set<string>(),
      attempted: new Set<string>(),
      qualified: new Set<string>(),
    };

    const score =
      r.assessmentUserScore ??
      ((r.mcqUserSectionScore ?? 0) + (r.codingUserSectionScore ?? 0) + (r.feUserSectionScore ?? 0) || 0);
    const max =
      r.assessmentTotalScore ??
      ((r.mcqSectionMaxScore ?? 0) + (r.codingSectionMaxScore ?? 0) + (r.feSectionMaxScore ?? 0) || 0);
    const scorePercentage = max > 0 ? (score / max) * 100 : null;
    const requiredPercentage = requiredFePercentage(identifiers, rules);
    const rawAssessmentStatus = (r.assessmentStatus ?? "").trim().toUpperCase();
    const status =
      scorePercentage != null
        ? getFeAssessmentStatus(identifiers, scorePercentage, r.userAssessmentStartDatetime, rules)
        : rawAssessmentStatus || "NOT ATTEMPTED";
    const statusSource =
      scorePercentage != null ? "qualification_rules" : rawAssessmentStatus ? "bigquery" : "inferred";

    if (r.organisationAssessmentId.trim()) {
      statusRows.push({
        userId: r.userId,
        organisationAssessmentId: r.organisationAssessmentId,
        assessmentTag: r.assessmentTag,
        assessmentTitle: r.assessmentTitle,
        cycle: r.cycle,
        assessmentNumber: n,
        attemptNumber: r.attemptNumber,
        score,
        maxScore: max > 0 ? max : null,
        scorePercentage,
        assessmentStatus: status,
        statusSource,
        rawAssessmentStatus: rawAssessmentStatus || null,
        requiredPercentage,
        calculatedAt: new Date(),
      });
    }

    bucket.total.add(r.userId);
    if (status === "QUALIFIED" || status === "NOT QUALIFIED") bucket.attempted.add(r.userId);
    if (status === "QUALIFIED") bucket.qualified.add(r.userId);
    buckets.set(tag, bucket);
  }

  for (let i = 0; i < statusRows.length; i += 300) {
    const batch = statusRows.slice(i, i + 300);
    await db
      .insert(irpL1AssessmentStatusesTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          irpL1AssessmentStatusesTable.userId,
          irpL1AssessmentStatusesTable.organisationAssessmentId,
        ],
        set: {
          assessmentTag: sql`excluded.assessment_tag`,
          assessmentTitle: sql`excluded.assessment_title`,
          cycle: sql`excluded.cycle`,
          assessmentNumber: sql`excluded.assessment_number`,
          attemptNumber: sql`excluded.attempt_number`,
          score: sql`excluded.score`,
          maxScore: sql`excluded.max_score`,
          scorePercentage: sql`excluded.score_percentage`,
          assessmentStatus: sql`excluded.assessment_status`,
          statusSource: sql`excluded.status_source`,
          rawAssessmentStatus: sql`excluded.raw_assessment_status`,
          requiredPercentage: sql`excluded.required_percentage`,
          calculatedAt: sql`excluded.calculated_at`,
          updatedAt: new Date(),
        },
      });
  }

  return [...buckets.values()]
    .sort((a, b) => a.order - b.order || a.tag.localeCompare(b.tag))
    .map((b) => ({
      tag: b.tag,
      total: b.total.size,
      attempted: b.attempted.size,
      qualified: b.qualified.size,
    }));
}
