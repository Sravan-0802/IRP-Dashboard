import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { GenAiTrainingPopup } from "@/components/irp/GenAiTrainingPopup";
import type { GenAiTrainingPopupConfig } from "@/lib/useGenAiTrainingConfig";
import { GENAI_TRAINING_POPUP_FALLBACK } from "@/lib/useGenAiTrainingConfig";

type FieldKey = keyof Pick<
  GenAiTrainingPopupConfig,
  "title" | "body" | "schedule" | "time" | "footer" | "ctaLabel" | "liveUrl" | "version"
>;

const FIELDS: Array<{ key: FieldKey; label: string; multiline?: boolean; hint?: string }> = [
  { key: "version", label: "Campaign version", hint: "Bump to re-show for students who dismissed earlier." },
  { key: "title", label: "Title" },
  { key: "body", label: "Body", multiline: true },
  { key: "schedule", label: "Schedule line" },
  { key: "time", label: "Time line" },
  { key: "footer", label: "Footer" },
  { key: "ctaLabel", label: "CTA button label" },
  { key: "liveUrl", label: "Live session URL" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function GenAiTrainingPopupPanel({ apiKey }: { apiKey: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<GenAiTrainingPopupConfig>(GENAI_TRAINING_POPUP_FALLBACK);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/genai-training-popup", {
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to load");
      setDraft(body as GenAiTrainingPopupConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load pop-up settings");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewContent = useMemo(() => draft, [draft]);

  async function save() {
    if (!apiKey.trim() || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/genai-training-popup", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-api-key": apiKey.trim() },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to save");
      setDraft(body as GenAiTrainingPopupConfig);
      setMessage("Saved. Paid students will see this content when the pop-up is enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: FieldKey, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="irp-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#6741d9]" />
              <h2 className="font-display text-lg font-extrabold text-[#0d1117]">GenAI Training pop-up</h2>
            </div>
            <p className="max-w-2xl text-sm text-[#6e6a8a]">
              Edit the dashboard pop-up shown to paid IRP students on login. Students can dismiss it;
              bump the campaign version to show it again after updates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(103,65,217,0.2)] px-3 py-1.5 text-xs font-semibold text-[#6941c6] hover:bg-[rgba(103,65,217,0.06)] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(103,65,217,0.2)] px-3 py-1.5 text-xs font-semibold text-[#6941c6] hover:bg-[rgba(103,65,217,0.06)] disabled:opacity-50"
            >
              Preview
            </button>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[#6e6a8a]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading pop-up settings…
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[rgba(103,65,217,0.12)] bg-[rgba(103,65,217,0.03)] px-4 py-3">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-[rgba(103,65,217,0.35)] text-[#6941c6]"
              />
              <span>
                <span className="block text-sm font-bold text-[#0d1117]">Show pop-up to students</span>
                <span className="block text-xs text-[#6e6a8a]">
                  When off, paid students will not see the GenAI Training pop-up.
                </span>
              </span>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              {FIELDS.map((field) => (
                <label
                  key={field.key}
                  className={`block ${field.multiline ? "md:col-span-2" : ""}`}
                >
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#6e6a8a]">
                    {field.label}
                  </span>
                  {field.multiline ? (
                    <textarea
                      value={draft[field.key]}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-[rgba(103,65,217,0.15)] px-3 py-2 text-sm text-[#0d1117] focus:border-[#6941c6] focus:outline-none focus:ring-2 focus:ring-[rgba(103,65,217,0.15)]"
                    />
                  ) : (
                    <input
                      type="text"
                      value={draft[field.key]}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="w-full rounded-xl border border-[rgba(103,65,217,0.15)] px-3 py-2 text-sm text-[#0d1117] focus:border-[#6941c6] focus:outline-none focus:ring-2 focus:ring-[rgba(103,65,217,0.15)]"
                    />
                  )}
                  {field.hint ? (
                    <span className="mt-1 block text-xs text-[#6e6a8a]">{field.hint}</span>
                  ) : null}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(103,65,217,0.08)] pt-4">
              <p className="text-xs text-[#6e6a8a]">Last saved: {formatDate(draft.updatedAt)}</p>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="btn-pop inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save pop-up
              </button>
            </div>
          </div>
        )}
      </div>

      {previewOpen ? (
        <GenAiTrainingPopup
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          content={previewContent}
        />
      ) : null}
    </div>
  );
}
