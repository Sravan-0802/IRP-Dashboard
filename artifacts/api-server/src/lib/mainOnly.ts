/**
 * IRP dashboard stage results (L1 / FE / NxtMock) use MAIN sits only.
 * MOCK is for practice links — never for scores, clearance, or journey.
 */

export function isMockLabel(value: string | null | undefined): boolean {
  const v = (value ?? "").trim().toUpperCase();
  if (!v) return false;
  if (v === "MOCK") return true;
  // Tag shape: ACADEMY-IRP-2.0_MOCK_L1_...
  if (/(?:^|_)MOCK(?:_|$)/.test(v)) return true;
  // Title shape: "FE Project Mock", "L1 Mock Assessment"
  if (/\bMOCK\b/.test(v)) return true;
  return false;
}

export function isMainLabel(value: string | null | undefined): boolean {
  const v = (value ?? "").trim().toUpperCase();
  if (!v) return false;
  if (v === "MAIN") return true;
  return /(?:^|_)MAIN(?:_|$)/.test(v);
}

/** True when title/tag/type clearly identify a MOCK sit. */
export function isMockAssessmentFields(fields: {
  title?: string | null;
  tag?: string | null;
  type?: string | null;
}): boolean {
  return (
    isMockLabel(fields.type) ||
    isMockLabel(fields.tag) ||
    isMockLabel(fields.title)
  );
}

/**
 * MAIN sits only. Explicit MOCK is rejected. Explicit non-MAIN type rejected.
 * Untyped portal rows without mock markers are treated as MAIN.
 */
export function isMainAssessmentFields(fields: {
  title?: string | null;
  tag?: string | null;
  type?: string | null;
}): boolean {
  if (isMockAssessmentFields(fields)) return false;
  const type = (fields.type ?? "").trim().toUpperCase();
  if (type && type !== "MAIN") return false;
  return true;
}
