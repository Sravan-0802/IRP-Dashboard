import { db, academyUserAssessmentDetailsTable } from "@workspace/db";
import { notInArray } from "drizzle-orm";
import { MANUAL_DASHBOARD_ACCESS_GRANT_ID, MANUAL_DASHBOARD_ACCESS_REVOKE_ID } from "./academyUserProfile";
import { feAssessmentIndex, getFeAssessmentStatus } from "./feQualification";
import { getFeQualificationRules } from "./feQualificationRules";
import { isMockAssessmentFields } from "./mainOnly";

export type FeTagSummary = { tag: string; total: number; attempted: number; qualified: number };

const FE_MAIN_TAG_PREFIX = "ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A";

function isFeRow(level: string | null, tag: string | null, title: string | null): boolean {
  const l = (level ?? "").toUpperCase();
  const t = (tag ?? "").toUpperCase();
  const ti = (title ?? "").toUpperCase();
  return (
    l.includes("FE-PROJECT") ||
    l.includes("FE_PROJECT") ||
    t.includes("FE-PROJECT") ||
    t.includes("FE_PROJECT") ||
    ti.includes("FE PROJECT") ||
    ti.includes("FE-PROJECT") ||
    (ti.includes("MAIN II") && (ti.includes("IRP") || ti.includes("PROJECT")))
  );
}

/**
 * Distinct students per FE MAIN assessment, scored with the saved FE rules (same as the student view).
 * z_* rows store only `A7`, portal rows the full tag; both group under the assessment number.
 */
export async function getFeAssessmentSummary(): Promise<FeTagSummary[]> {
  const rules = await getFeQualificationRules();
  const rows = await db
    .select({
      userId: academyUserAssessmentDetailsTable.userId,
      assessmentTag: academyUserAssessmentDetailsTable.assessmentTag,
      assessmentTitle: academyUserAssessmentDetailsTable.assessmentTitle,
      level: academyUserAssessmentDetailsTable.level,
      cycle: academyUserAssessmentDetailsTable.cycle,
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
  for (const r of rows) {
    if (!isFeRow(r.level, r.assessmentTag, r.assessmentTitle)) continue;
    if (isMockAssessmentFields({ tag: r.assessmentTag, title: r.assessmentTitle })) continue;

    const identifiers = [r.cycle, r.assessmentTag, r.assessmentTitle];
    const n = identifiers.map(feAssessmentIndex).find((v) => v != null) ?? null;
    const tag = n != null ? `${FE_MAIN_TAG_PREFIX}${n}` : (r.assessmentTag ?? r.cycle ?? "Unknown");
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
    const status =
      max > 0
        ? getFeAssessmentStatus(identifiers, (score / max) * 100, r.userAssessmentStartDatetime, rules)
        : (r.assessmentStatus ?? "").trim().toUpperCase();

    bucket.total.add(r.userId);
    if (status === "QUALIFIED" || status === "NOT QUALIFIED") bucket.attempted.add(r.userId);
    if (status === "QUALIFIED") bucket.qualified.add(r.userId);
    buckets.set(tag, bucket);
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
