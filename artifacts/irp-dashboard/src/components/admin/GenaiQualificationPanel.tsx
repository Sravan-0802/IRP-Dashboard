import { useCallback, useEffect, useState } from "react";
import { DatabaseZap, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { TagSummaryTable, type TagSummary } from "./TagSummaryTable";

type GenaiRule = {
  id: string;
  tag: string;
  fromNumber: number;
  toNumber: number | null;
  minMcq: number;
  minCoding: number;
};

type RulesResponse = { rules?: GenaiRule[]; summary?: TagSummary[]; error?: string };

function newId(): string {
  return `rule-${Math.random().toString(36).slice(2, 8)}`;
}

export function GenaiQualificationPanel({ apiKey }: { apiKey: string }) {
  const [rules, setRules] = useState<GenaiRule[]>([]);
  const [summary, setSummary] = useState<TagSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/genai-qualification-rules", {
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = (await res.json().catch(() => ({}))) as RulesResponse;
      if (!res.ok) throw new Error(body.error ?? "Could not load GenAI rules");
      setRules(Array.isArray(body.rules) ? body.rules : []);
      setSummary(Array.isArray(body.summary) ? body.summary : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load GenAI rules");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function update(index: number, patch: Partial<GenaiRule>) {
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/genai-qualification-rules", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-api-key": apiKey.trim() },
        body: JSON.stringify({
          rules: rules.map((rule) => ({
            ...rule,
            tag: rule.tag.trim(),
            fromNumber: Number(rule.fromNumber),
            toNumber: rule.toNumber == null || Number.isNaN(Number(rule.toNumber)) ? null : Number(rule.toNumber),
            minMcq: Number(rule.minMcq),
            minCoding: Number(rule.minCoding),
          })),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as RulesResponse;
      if (!res.ok) throw new Error(body.error ?? "Could not save GenAI rules");
      if (Array.isArray(body.rules)) setRules(body.rules);
      if (Array.isArray(body.summary)) setSummary(body.summary);
      setMessage("Saved. GenAI results use these rules. Students do not see them.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save GenAI rules");
    } finally {
      setSaving(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/genai-results/sync", {
        method: "POST",
        headers: { "x-api-key": apiKey.trim() },
      });
      const body = (await res.json().catch(() => ({}))) as {
        results?: { table: string; status: string; rowCount: number; error?: string }[];
        summary?: TagSummary[];
        error?: string;
      };
      if (Array.isArray(body.summary)) setSummary(body.summary);
      const failed = body.results?.find((r) => r.status !== "success");
      if (!res.ok || failed) throw new Error(failed?.error ?? body.error ?? "GenAI sync failed");
      const counts = (body.results ?? []).map((r) => `${r.rowCount} ${r.table.includes("nxtmock") ? "interview" : "assessment"} rows`);
      setMessage(`Synced from BigQuery: ${counts.join(", ")}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "GenAI sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="irp-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-[#101828]">GenAI qualification rules</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#667085]">
            A GenAI MAIN assessment qualifies when the MCQ score and the coding score both meet the minimums you set.
            Minimums are marks, not percentages. The number is the A at the end of the tag: A1 is 1, A2 is 2.
            <span className="mt-1 block">
              <span className="font-semibold text-[#344054]">From</span> is the first assessment in that rule.
              <span className="font-semibold text-[#344054]"> Through</span> is the last.
              Leave Through empty when the rule should keep applying to every later assessment, such as A3 and A4.
            </span>
            An exact tag match wins, then the narrower range. These rules stay in the admin panel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d0d5dd] px-3 py-2 text-xs font-semibold text-[#344054] disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DatabaseZap className="h-3.5 w-3.5" />}
            Sync GenAI results now
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d0d5dd] px-3 py-2 text-xs font-semibold text-[#344054]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rules
        </p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <div
              key={rule.id}
              className="grid gap-3 rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-3 md:grid-cols-[minmax(0,1.6fr)_80px_80px_90px_90px_auto]"
            >
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
                Min MCQ
                <input
                  type="number"
                  min={0}
                  value={rule.minMcq}
                  onChange={(event) => update(index, { minMcq: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm font-medium text-[#101828]"
                />
              </label>
              <label className="block text-xs font-semibold text-[#344054]">
                Min Coding
                <input
                  type="number"
                  min={0}
                  value={rule.minCoding}
                  onChange={(event) => update(index, { minCoding: Number(event.target.value) })}
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
                  { id: newId(), tag: "", fromNumber: 1, toNumber: 1, minMcq: 25, minCoding: 48 },
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
        note="MAIN assessments only. Updates every day at the BigQuery sync, or when you sync now."
        emptyText="No GenAI results synced yet."
      />
    </section>
  );
}
