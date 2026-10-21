import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { TagSummaryTable, type TagSummary } from "./TagSummaryTable";

type FeRule = {
  id: string;
  tag: string;
  fromNumber: number;
  toNumber: number | null;
  minPercentage: number;
};

function newId(): string {
  return `rule-${Math.random().toString(36).slice(2, 8)}`;
}

export function FeQualificationPanel({ apiKey }: { apiKey: string }) {
  const [rules, setRules] = useState<FeRule[]>([]);
  const [summary, setSummary] = useState<TagSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/fe-qualification-rules", {
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Could not load FE rules");
      setRules(Array.isArray((body as { rules?: FeRule[] }).rules) ? (body as { rules: FeRule[] }).rules : []);
      const loaded = (body as { summary?: TagSummary[] }).summary;
      setSummary(Array.isArray(loaded) ? loaded : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load FE rules");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function update(index: number, patch: Partial<FeRule>) {
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/fe-qualification-rules", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-api-key": apiKey.trim() },
        body: JSON.stringify({
          rules: rules.map((rule) => ({
            ...rule,
            tag: rule.tag.trim(),
            fromNumber: Number(rule.fromNumber),
            toNumber: rule.toNumber == null || Number.isNaN(Number(rule.toNumber)) ? null : Number(rule.toNumber),
            minPercentage: Number(rule.minPercentage),
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Could not save FE rules");
      setRules(Array.isArray((body as { rules?: FeRule[] }).rules) ? (body as { rules: FeRule[] }).rules : rules);
      const saved = (body as { summary?: TagSummary[] }).summary;
      if (Array.isArray(saved)) setSummary(saved);
      setMessage("Saved. FE results use these rules. Students do not see them.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save FE rules");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="irp-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-[#101828]">FE qualification rules</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#667085]">
            A matching assessment tag qualifies when the score percentage is at least the value you set.
            The number is the A at the end of the tag: A1 is 1, A7 is 7.
            <span className="mt-1 block">
              <span className="font-semibold text-[#344054]">From</span> is the first assessment in that rule.
              <span className="font-semibold text-[#344054]"> Through</span> is the last.
              Leave Through empty when the rule should keep applying to every later assessment, such as A7, A8, and A9.
            </span>
            A narrower range wins over a wider one. These rules stay in the admin panel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d0d5dd] px-3 py-2 text-xs font-semibold text-[#344054]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rules
        </p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <div key={rule.id} className="grid gap-3 rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-3 md:grid-cols-[minmax(0,1.6fr)_90px_90px_90px_auto]">
              <label className="block text-xs font-semibold text-[#344054]">
                Tag
                <input
                  value={rule.tag}
                  onChange={(event) => update(index, { tag: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm font-medium text-[#101828]"
                />
              </label>
              <label className="block text-xs font-semibold text-[#344054]">
                From
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={rule.fromNumber}
                  onChange={(event) => update(index, { fromNumber: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm font-medium text-[#101828]"
                />
              </label>
              <label className="block text-xs font-semibold text-[#344054]">
                Through
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={rule.toNumber ?? ""}
                  placeholder="Onwards"
                  onChange={(event) => {
                    const raw = event.target.value.trim();
                    update(index, { toNumber: raw === "" ? null : Number(raw) });
                  }}
                  className="mt-1 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm font-medium text-[#101828]"
                />
              </label>
              <label className="block text-xs font-semibold text-[#344054]">
                Min %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rule.minPercentage}
                  onChange={(event) => update(index, { minPercentage: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm font-medium text-[#101828]"
                />
              </label>
              <button
                type="button"
                onClick={() => setRules((current) => current.filter((_, i) => i !== index))}
                className="self-end inline-flex items-center justify-center rounded-lg border border-[#fda29b] px-3 py-2 text-[#b42318]"
                aria-label="Delete rule"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setRules((current) => [
                  ...current,
                  { id: newId(), tag: "", fromNumber: 1, toNumber: 1, minPercentage: 90 },
                ])
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d0d5dd] px-3 py-2 text-xs font-semibold text-[#344054]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add rule
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || rules.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6941c6] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
            {message ? <span className="text-xs font-semibold text-[#027a48]">{message}</span> : null}
            {error ? <span className="text-xs font-semibold text-[#b42318]">{error}</span> : null}
          </div>
        </div>
      )}

      <TagSummaryTable
        summary={summary}
        note="MAIN FE assessments only, counted as distinct students with the rules above. Updates every day at the BigQuery sync."
        emptyText="No FE results synced yet."
      />
    </section>
  );
}
