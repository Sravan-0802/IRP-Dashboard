import { db, genAiTrainingPopupTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const ROW_ID = 1;

export const GENAI_TRAINING_POPUP_DEFAULTS = {
  enabled: false,
  version: "2026-09",
  title: "🚀 GenAI Training for Internships × IRP",
  body: "Join our live GenAI sessions designed to help you build industry-ready AI skills for internships.",
  schedule: "📅 Monday • Wednesday • Friday",
  time: "🕖 7:00 PM – 9:00 PM",
  footer: "Don't miss out!",
  ctaLabel: "Join Now / Watch Live",
  liveUrl:
    process.env.GENAI_TRAINING_LIVE_URL?.trim() ||
    "https://meetings.ccbp.in/mid/irp-genai-training",
};

export type GenAiTrainingPopupResponse = {
  enabled: boolean;
  version: string;
  title: string;
  body: string;
  schedule: string;
  time: string;
  footer: string;
  ctaLabel: string;
  liveUrl: string;
  updatedAt: string | null;
};

function toResponse(row: typeof genAiTrainingPopupTable.$inferSelect): GenAiTrainingPopupResponse {
  return {
    enabled: row.enabled === 1,
    version: row.version,
    title: row.title,
    body: row.body,
    schedule: row.schedule,
    time: row.time,
    footer: row.footer,
    ctaLabel: row.ctaLabel,
    liveUrl: row.liveUrl,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

function defaultsRow(): typeof genAiTrainingPopupTable.$inferSelect {
  const now = new Date();
  return {
    id: ROW_ID,
    enabled: GENAI_TRAINING_POPUP_DEFAULTS.enabled ? 1 : 0,
    version: GENAI_TRAINING_POPUP_DEFAULTS.version,
    title: GENAI_TRAINING_POPUP_DEFAULTS.title,
    body: GENAI_TRAINING_POPUP_DEFAULTS.body,
    schedule: GENAI_TRAINING_POPUP_DEFAULTS.schedule,
    time: GENAI_TRAINING_POPUP_DEFAULTS.time,
    footer: GENAI_TRAINING_POPUP_DEFAULTS.footer,
    ctaLabel: GENAI_TRAINING_POPUP_DEFAULTS.ctaLabel,
    liveUrl: GENAI_TRAINING_POPUP_DEFAULTS.liveUrl,
    updatedAt: now,
  };
}

export async function getGenAiTrainingPopup(): Promise<GenAiTrainingPopupResponse> {
  const [row] = await db
    .select()
    .from(genAiTrainingPopupTable)
    .where(eq(genAiTrainingPopupTable.id, ROW_ID))
    .limit(1);

  if (!row) return toResponse(defaultsRow());
  return toResponse(row);
}

export type GenAiTrainingPopupUpdate = Partial<{
  enabled: boolean;
  version: string;
  title: string;
  body: string;
  schedule: string;
  time: string;
  footer: string;
  ctaLabel: string;
  liveUrl: string;
}>;

function trimStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseGenAiTrainingPopupBody(
  body: unknown,
): { ok: true; patch: GenAiTrainingPopupUpdate } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const raw = body as Record<string, unknown>;
  const patch: GenAiTrainingPopupUpdate = {};

  if ("enabled" in raw) {
    if (typeof raw.enabled !== "boolean") {
      return { ok: false, error: "enabled must be a boolean" };
    }
    patch.enabled = raw.enabled;
  }

  const stringFields: Array<keyof GenAiTrainingPopupUpdate> = [
    "version",
    "title",
    "body",
    "schedule",
    "time",
    "footer",
    "ctaLabel",
    "liveUrl",
  ];

  for (const key of stringFields) {
    if (!(key in raw)) continue;
    const val = trimStr(raw[key]);
    if (!val) {
      return { ok: false, error: `${key} must be a non-empty string` };
    }
    if (key === "liveUrl" && !isHttpUrl(val)) {
      return { ok: false, error: "liveUrl must be a valid http(s) URL" };
    }
    patch[key] = val;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Provide at least one field to update" };
  }

  return { ok: true, patch };
}

export async function updateGenAiTrainingPopup(
  patch: GenAiTrainingPopupUpdate,
): Promise<GenAiTrainingPopupResponse> {
  const current = await getGenAiTrainingPopup();
  const merged = {
    enabled: patch.enabled ?? current.enabled,
    version: patch.version ?? current.version,
    title: patch.title ?? current.title,
    body: patch.body ?? current.body,
    schedule: patch.schedule ?? current.schedule,
    time: patch.time ?? current.time,
    footer: patch.footer ?? current.footer,
    ctaLabel: patch.ctaLabel ?? current.ctaLabel,
    liveUrl: patch.liveUrl ?? current.liveUrl,
  };

  const [row] = await db
    .insert(genAiTrainingPopupTable)
    .values({
      id: ROW_ID,
      enabled: merged.enabled ? 1 : 0,
      version: merged.version,
      title: merged.title,
      body: merged.body,
      schedule: merged.schedule,
      time: merged.time,
      footer: merged.footer,
      ctaLabel: merged.ctaLabel,
      liveUrl: merged.liveUrl,
    })
    .onConflictDoUpdate({
      target: genAiTrainingPopupTable.id,
      set: {
        enabled: merged.enabled ? 1 : 0,
        version: merged.version,
        title: merged.title,
        body: merged.body,
        schedule: merged.schedule,
        time: merged.time,
        footer: merged.footer,
        ctaLabel: merged.ctaLabel,
        liveUrl: merged.liveUrl,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toResponse(row!);
}
