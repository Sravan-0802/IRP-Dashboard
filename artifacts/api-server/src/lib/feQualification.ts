import { getCachedFeRules, type FeQualificationRule } from "./feQualificationRules";

export type FeAssessmentStatus = "QUALIFIED" | "NOT QUALIFIED" | "NOT ATTEMPTED";

/** Assessment index from `A7` or `..._FE-Project_A7`. */
export function feAssessmentIndex(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const match = value.toUpperCase().match(/(?:^|[_\s-])A(\d+)\b/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) ? n : null;
}

function identifiersOf(value: string | Array<string | null | undefined> | null | undefined): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/**
 * Exact tag match wins. Otherwise the narrowest number range that covers the assessment wins.
 * An empty "through" number means that assessment and every later one.
 */
export function requiredFePercentage(
  assessment: string | Array<string | null | undefined> | null | undefined,
  rules: FeQualificationRule[] = getCachedFeRules(),
): number | null {
  const identifiers = identifiersOf(assessment);
  const n = identifiers.map(feAssessmentIndex).find((value) => value != null) ?? null;
  let best: { span: number; min: number } | null = null;
  for (const rule of rules) {
    const tag = rule.tag.trim().toUpperCase();
    const exact = tag.length > 0 && identifiers.some((id) => id.trim().toUpperCase() === tag);
    let span: number | null = null;
    if (exact) span = -1;
    else if (n != null && n >= rule.fromNumber && (rule.toNumber == null || n <= rule.toNumber)) {
      span = rule.toNumber == null ? 10_000 : rule.toNumber - rule.fromNumber;
    }
    if (span == null) continue;
    if (!best || span < best.span) best = { span, min: rule.minPercentage };
  }
  return best?.min ?? null;
}

/** Qualifies when the score meets the configured percentage for that assessment tag. */
export function getFeAssessmentStatus(
  assessment: string | Array<string | null | undefined> | null | undefined,
  scorePercentage: number | null,
  userAssessmentStartDatetime: Date | string | null | undefined,
  rules: FeQualificationRule[] = getCachedFeRules(),
): FeAssessmentStatus {
  const required = requiredFePercentage(assessment, rules);
  if (scorePercentage != null && required != null && scorePercentage >= required) {
    return "QUALIFIED";
  }
  return userAssessmentStartDatetime != null ? "NOT QUALIFIED" : "NOT ATTEMPTED";
}
