import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { feAssessmentIndex } from "./feQualification";

export type GenaiQualificationRule = {
  id: string;
  tag: string;
  /** Inclusive assessment number, e.g. 1 for A1. */
  fromNumber: number;
  /** Inclusive end. Null means this number and every later assessment. */
  toNumber: number | null;
  /** Minimum MCQ section score (absolute marks, not percent). */
  minMcq: number;
  /** Minimum coding section score (absolute marks, not percent). */
  minCoding: number;
};

export const DEFAULT_GENAI_QUALIFICATION_RULES: GenaiQualificationRule[] = [
  {
    id: "genai-a1",
    tag: "ACADEMY-GENAI-IRP-2.0_MAIN_ASSESSMENT_A1",
    fromNumber: 1,
    toNumber: 1,
    minMcq: 20,
    minCoding: 48,
  },
  {
    id: "genai-a2-on",
    tag: "ACADEMY-GENAI-IRP-2.0_MAIN_ASSESSMENT_A2",
    fromNumber: 2,
    toNumber: null,
    minMcq: 25,
    minCoding: 48,
  },
];

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS genai_qualification_rules (
  id integer PRIMARY KEY DEFAULT 1,
  payload text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

let ensurePromise: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function validScore(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1000;
}

export function parseGenaiQualificationRules(value: unknown): GenaiQualificationRule[] | null {
  if (!Array.isArray(value)) return null;
  const rules: GenaiQualificationRule[] = [];
  for (const item of value.slice(0, 40)) {
    const row = asRecord(item);
    if (!row) continue;
    const tag = typeof row.tag === "string" ? row.tag.trim().slice(0, 200) : "";
    const fromNumber = Number(row.fromNumber);
    const toRaw = row.toNumber;
    const toNumber = toRaw == null || toRaw === "" ? null : Number(toRaw);
    const minMcq = Number(row.minMcq);
    const minCoding = Number(row.minCoding);
    if (!tag || !Number.isInteger(fromNumber) || fromNumber < 1 || fromNumber > 99) continue;
    if (toNumber != null && (!Number.isInteger(toNumber) || toNumber < fromNumber || toNumber > 99)) continue;
    if (!validScore(minMcq) || !validScore(minCoding)) continue;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 40) : `rule-${rules.length + 1}`;
    rules.push({ id, tag, fromNumber, toNumber, minMcq, minCoding });
  }
  return rules.length > 0 ? rules : null;
}

export async function getGenaiQualificationRules(): Promise<GenaiQualificationRule[]> {
  await ensureTable();
  const result = await db.execute(sql`SELECT payload FROM genai_qualification_rules WHERE id = 1 LIMIT 1`);
  const row = ((result as { rows?: { payload?: string }[] }).rows ?? [])[0];
  if (!row?.payload) return DEFAULT_GENAI_QUALIFICATION_RULES;
  try {
    return parseGenaiQualificationRules(JSON.parse(row.payload)) ?? DEFAULT_GENAI_QUALIFICATION_RULES;
  } catch {
    return DEFAULT_GENAI_QUALIFICATION_RULES;
  }
}

export async function updateGenaiQualificationRules(
  rules: GenaiQualificationRule[],
): Promise<GenaiQualificationRule[]> {
  await ensureTable();
  const payload = JSON.stringify(rules);
  await db.execute(sql`
    INSERT INTO genai_qualification_rules (id, payload, updated_at)
    VALUES (1, ${payload}, now())
    ON CONFLICT (id) DO UPDATE SET payload = excluded.payload, updated_at = now()
  `);
  return rules;
}

/** Exact tag match wins. Otherwise the narrowest number range that covers the assessment wins. */
export function matchGenaiRule(
  identifiers: Array<string | null | undefined>,
  rules: GenaiQualificationRule[],
): GenaiQualificationRule | null {
  const ids = identifiers.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const n = ids.map(feAssessmentIndex).find((v) => v != null) ?? null;
  let best: { span: number; rule: GenaiQualificationRule } | null = null;
  for (const rule of rules) {
    const tag = rule.tag.trim().toUpperCase();
    const exact = tag.length > 0 && ids.some((id) => id.trim().toUpperCase() === tag);
    let span: number | null = null;
    if (exact) span = -1;
    else if (n != null && n >= rule.fromNumber && (rule.toNumber == null || n <= rule.toNumber)) {
      span = rule.toNumber == null ? 10_000 : rule.toNumber - rule.fromNumber;
    }
    if (span == null) continue;
    if (!best || span < best.span) best = { span, rule };
  }
  return best?.rule ?? null;
}
