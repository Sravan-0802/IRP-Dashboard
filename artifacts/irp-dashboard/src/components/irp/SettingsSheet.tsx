import { useState } from "react";
import { X, Zap, Trophy, AlertTriangle } from "lucide-react";
import type { Journey, JourneyState } from "@/lib/journey";
import { STANDARD_STATES, WILDCARD_STATES } from "@/lib/journey";
import { useSwitchPath, useSetJourneyState } from "@/lib/useJourney";
import { WildcardConfirm } from "./WildcardConfirm";

export function SettingsSheet({
  journey,
  open,
  onClose,
  initialMode = "menu",
}: {
  journey: Journey;
  open: boolean;
  onClose: () => void;
  initialMode?: "menu" | "to-wildcard" | "to-standard";
}) {
  const [mode, setMode] = useState<"menu" | "to-wildcard" | "to-standard">(initialMode);
  const switchPath = useSwitchPath();
  const setState = useSetJourneyState();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const standardToWildcardBlocked = journey.hasAttemptedL1 || journey.journeyState !== "L1_PREP";
  const states = journey.isWildcard ? WILDCARD_STATES : STANDARD_STATES;

  function close() {
    setMode("menu");
    setError(null);
    onClose();
  }

  function doSwitch(to: "standard" | "wildcard") {
    setError(null);
    switchPath.mutate(to, {
      onSuccess: close,
      onError: (e) => setError(e instanceof Error ? e.message : "Switch failed"),
    });
  }

  return (
    <div className="fixed inset-0 z-[120] flex justify-end">
      <button type="button" aria-label="Close settings" className="absolute inset-0 bg-[rgba(13,17,23,0.35)] backdrop-blur-sm" onClick={close} />
      <div className="relative flex h-full w-[min(420px,92vw)] flex-col overflow-y-auto border-l border-[rgba(103,65,217,0.1)] bg-[rgba(255,255,255,0.96)] p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-ink">Settings</h2>
          <button type="button" onClick={close} className="rounded-lg p-1.5 text-muted2 hover:bg-[rgba(103,65,217,0.05)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mode === "menu" && (
          <div className="space-y-6">
            <section>
              <p className="section-label mb-3 text-muted2">Learning path</p>
              <div className="rounded-xl border border-[rgba(103,65,217,0.1)] bg-surface p-4">
                <p className="text-sm text-muted2">
                  You're on the{" "}
                  <span className="font-bold text-ink">
                    {journey.isWildcard ? "Wildcard (Direct L3)" : "Standard"}
                  </span>{" "}
                  path.
                </p>

                {journey.isWildcard ? (
                  <button
                    type="button"
                    onClick={() => setMode("to-standard")}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-l1 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  >
                    <Trophy className="h-4 w-4" /> Switch to Standard Path
                  </button>
                ) : standardToWildcardBlocked ? (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-[rgba(245,159,0,0.2)] bg-l2-bg p-3 text-xs text-l2-text">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-l2-text" />
                    You've already begun the standard path assessment. Switching to Wildcard is no
                    longer available.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode("to-wildcard")}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(230,73,128,0.4)] bg-l3-bg px-4 py-2.5 text-sm font-bold text-l3-text transition-colors hover:bg-[#ffe3ef]"
                  >
                    <Zap className="h-4 w-4" /> Switch to Wildcard
                  </button>
                )}
              </div>
            </section>

            <section>
              <p className="section-label mb-3 text-muted2">
                Preview state (demo)
              </p>
              <select
                value={journey.journeyState}
                onChange={(e) => setState.mutate(e.target.value as JourneyState)}
                className="w-full rounded-lg border border-[rgba(103,65,217,0.15)] bg-surface px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-l1"
              >
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-dim">
                Simulates the journey_state an admin/webhook would set.
              </p>
            </section>

            {error && <p className="text-sm text-red">{error}</p>}
          </div>
        )}

        {mode === "to-wildcard" && (
          <WildcardConfirm
            busy={switchPath.isPending}
            onConfirm={() => doSwitch("wildcard")}
            onCancel={() => setMode("menu")}
            cancelLabel="Cancel, stay on Standard"
          />
        )}

        {mode === "to-standard" && (
          <div className="rounded-xl border border-[rgba(103,65,217,0.15)] bg-[rgba(103,65,217,0.06)] p-5">
            <h3 className="font-display text-lg font-extrabold text-ink">Are you sure?</h3>
            <p className="mt-2 text-sm text-muted2">
              You'll start from L1. This cannot be undone once your L3 exam has started. Your
              learning progress won't be lost.
            </p>
            {error && <p className="mt-3 text-sm text-red">{error}</p>}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={switchPath.isPending}
                onClick={() => doSwitch("standard")}
                className="rounded-xl bg-l1 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Yes, switch to Standard Path
              </button>
              <button
                type="button"
                onClick={() => setMode("menu")}
                className="rounded-xl border border-[rgba(103,65,217,0.2)] bg-[rgba(103,65,217,0.08)] px-4 py-2.5 text-sm font-bold text-brand transition-colors hover:bg-[rgba(103,65,217,0.12)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
