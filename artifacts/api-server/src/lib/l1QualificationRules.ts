import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type L1QualificationRule = {
  id: string;
  tag: string;
  /** Inclusive assessment number, e.g. 1 for A1. */
  fromNumber: number;
  /** Inclusive end. Null means this number and every later assessment. */
  toNumber: number | null;
  minPercentage: number;
};

export const DEFAULT_L1_QUALIFICATION_RULES: L1QualificationRule[] = [
  {
    id: "a1-on",
    tag: "ACADEMY-IRP-2.0_MAIN_L1_HUSTLER-ASSESSMENT_A1",
    fromNumber: 1,
    toNumber: null,
    minPercentage: 70,
  },
];

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS l1_qualification_rules (
  id integer PRIMARY KEY DEFAULT 1,
  payload text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

let ensurePromise: Promise<void> | null = null;
let cachedRules: L1QualificationRule[] = DEFAULT_L1_QUALIFICATION_RULES;

export function getCachedL1Rules(): L1QualificationRule[] {
  return cachedRules;
}

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

export function parseL1QualificationRules(value: unknown): L1QualificationRule[] | null {
  if (!Array.isArray(value)) return null;
  const rules: L1QualificationRule[] = [];
  for (const item of value.slice(0, 40)) {
    const row = asRecord(item);
    if (!row) continue;
    const tag = typeof row.tag === "string" ? row.tag.trim().slice(0, 200) : "";
    const fromNumber = Number(row.fromNumber);
    const toRaw = row.toNumber;
    const toNumber = toRaw == null || toRaw === "" ? null : Number(toRaw);
    const minPercentage = Number(row.minPercentage);
    if (!tag || !Number.isInteger(fromNumber) || fromNumber < 1 || fromNumber > 99) continue;
    if (toNumber != null && (!Number.isInteger(toNumber) || toNumber < fromNumber || toNumber > 99)) continue;
    if (!Number.isFinite(minPercentage) || minPercentage < 0 || minPercentage > 100) continue;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 40) : `rule-${rules.length + 1}`;
    rules.push({ id, tag, fromNumber, toNumber, minPercentage });
  }
  return rules.length > 0 ? rules : null;
}

export async function getL1QualificationRules(): Promise<L1QualificationRule[]> {
  await ensureTable();
  const result = await db.execute(sql`SELECT payload FROM l1_qualification_rules WHERE id = 1 LIMIT 1`);
  const row = ((result as { rows?: { payload?: string }[] }).rows ?? [])[0];
  if (!row?.payload) {
    cachedRules = DEFAULT_L1_QUALIFICATION_RULES;
    return cachedRules;
  }
  try {
    const parsed = parseL1QualificationRules(JSON.parse(row.payload));
    cachedRules = parsed ?? DEFAULT_L1_QUALIFICATION_RULES;
  } catch {
    cachedRules = DEFAULT_L1_QUALIFICATION_RULES;
  }
  return cachedRules;
}

export async function updateL1QualificationRules(
  rules: L1QualificationRule[],
): Promise<L1QualificationRule[]> {
  await ensureTable();
  const payload = JSON.stringify(rules);
  await db.execute(sql`
    INSERT INTO l1_qualification_rules (id, payload, updated_at)
    VALUES (1, ${payload}, now())
    ON CONFLICT (id) DO UPDATE SET payload = excluded.payload, updated_at = now()
  `);
  cachedRules = rules;
  return rules;
}
