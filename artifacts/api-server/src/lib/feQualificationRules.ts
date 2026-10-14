import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type FeQualificationRule = {
  id: string;
  tag: string;
  /** Inclusive assessment number, e.g. 1 for A1. */
  fromNumber: number;
  /** Inclusive end. Null means this number and every later assessment. */
  toNumber: number | null;
  minPercentage: number;
};

export const DEFAULT_FE_QUALIFICATION_RULES: FeQualificationRule[] = [
  {
    id: "a1",
    tag: "ACADEMY-IRP-2.0_MOCK_L1_FE-Project_A1",
    fromNumber: 1,
    toNumber: 1,
    minPercentage: 70,
  },
  {
    id: "a2",
    tag: "ACADEMY-IRP-2.0_MOCK_L1_FE-Project_A2",
    fromNumber: 2,
    toNumber: 2,
    minPercentage: 100,
  },
  {
    id: "a3-a6",
    tag: "ACADEMY-IRP-2.0_MOCK_L1_FE-Project_A3",
    fromNumber: 3,
    toNumber: 6,
    minPercentage: 90,
  },
  {
    id: "a7-on",
    tag: "ACADEMY-IRP-2.0_MOCK_L1_FE-Project_A7",
    fromNumber: 7,
    toNumber: null,
    minPercentage: 75,
  },
];

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS fe_qualification_rules (
  id integer PRIMARY KEY DEFAULT 1,
  payload text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

let ensurePromise: Promise<void> | null = null;
let cachedRules: FeQualificationRule[] = DEFAULT_FE_QUALIFICATION_RULES;

export function getCachedFeRules(): FeQualificationRule[] {
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

export function parseFeQualificationRules(value: unknown): FeQualificationRule[] | null {
  if (!Array.isArray(value)) return null;
  const rules: FeQualificationRule[] = [];
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

export async function getFeQualificationRules(): Promise<FeQualificationRule[]> {
  await ensureTable();
  const result = await db.execute(sql`SELECT payload FROM fe_qualification_rules WHERE id = 1 LIMIT 1`);
  const row = ((result as { rows?: { payload?: string }[] }).rows ?? [])[0];
  if (!row?.payload) {
    cachedRules = DEFAULT_FE_QUALIFICATION_RULES;
    return cachedRules;
  }
  try {
    const parsed = parseFeQualificationRules(JSON.parse(row.payload));
    cachedRules = parsed ?? DEFAULT_FE_QUALIFICATION_RULES;
  } catch {
    cachedRules = DEFAULT_FE_QUALIFICATION_RULES;
  }
  return cachedRules;
}

export async function updateFeQualificationRules(
  rules: FeQualificationRule[],
): Promise<FeQualificationRule[]> {
  await ensureTable();
  const payload = JSON.stringify(rules);
  await db.execute(sql`
    INSERT INTO fe_qualification_rules (id, payload, updated_at)
    VALUES (1, ${payload}, now())
    ON CONFLICT (id) DO UPDATE SET payload = excluded.payload, updated_at = now()
  `);
  cachedRules = rules;
  return rules;
}
