const STORAGE_PREFIX = "irp-genai-project-choices:v1";

export function projectChoicesKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

/** Reject obsolete/corrupt entries and enforce the same limit as the chooser. */
export function normalizeProjectChoices(value: unknown, available: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((title): title is string =>
    typeof title === "string" && available.includes(title),
  ))].slice(0, 2);
}

export function loadProjectChoices(
  storage: Pick<Storage, "getItem">,
  userId: string,
  available: readonly string[],
): string[] {
  const raw = storage.getItem(projectChoicesKey(userId));
  if (!raw) return [];
  // A malformed preference is not a storage outage; let the student replace it.
  try {
    return normalizeProjectChoices(JSON.parse(raw), available);
  } catch {
    return [];
  }
}

export function saveProjectChoices(
  storage: Pick<Storage, "setItem">,
  userId: string,
  value: readonly string[],
  available: readonly string[],
): string[] {
  const next = normalizeProjectChoices(value, available);
  storage.setItem(projectChoicesKey(userId), JSON.stringify(next));
  return next;
}
