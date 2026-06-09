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
      <button type="button" aria-label="Close settings" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative flex h-full w-[min(420px,92vw)] flex-col overflow-y-auto border-l border-[#8a6eff1f] bg-[#0b0b16] p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-[#e8e6ff]">Settings</h2>
          <button type="button" onClick={close} className="rounded-lg p-1.5 text-[#7a6eaa] hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mode === "menu" && (
          <div className="space-y-6">
            <section>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#7a6eaa]">Learning path</p>
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-sm text-[#a99fce]">
                  You're on the{" "}
                  <span className="font-bold text-[#e8e6ff]">
                    {journey.isWildcard ? "Wildcard (Direct L3)" : "Standard"}
                  </span>{" "}
                  path.
                </p>

                {journey.isWildcard ? (
                  <button
                    type="button"
                    onClick={() => setMode("to-standard")}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8a6eff] to-[#c45fff] px-4 py-2.5 text-sm font-bold text-white"
                  >
                    <Trophy className="h-4 w-4" /> Switch to Standard Path
                  </button>
                ) : standardToWildcardBlocked ? (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-[#a99fce]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ffc564]" />
                    You've already begun the standard path assessment. Switching to Wildcard is no
                    longer available.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode("to-wildcard")}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#ff6eb4]/40 bg-[#ff6eb4]/10 px-4 py-2.5 text-sm font-bold text-[#ff9ccf]"
                  >
                    <Zap className="h-4 w-4" /> Switch to Wildcard
                  </button>
                )}
              </div>
            </section>

            <section>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#7a6eaa]">
                Preview state (demo)
              </p>
              <select
                value={journey.journeyState}
                onChange={(e) => setState.mutate(e.target.value as JourneyState)}
                className="w-full rounded-xl border border-white/10 bg-[#11111f] px-3 py-2.5 text-sm font-semibold text-[#e8e6ff] outline-none focus:border-[#8a6eff]"
              >
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-[#4a4060]">
                Simulates the journey_state an admin/webhook would set.
              </p>
            </section>

            {error && <p className="text-sm text-[#ff7a9c]">{error}</p>}
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
          <div className="rounded-xl border border-[#8a6eff]/25 bg-[#8a6eff]/10 p-5">
            <h3 className="font-display text-lg font-extrabold text-[#e8e6ff]">Are you sure?</h3>
            <p className="mt-2 text-sm text-[#a99fce]">
              You'll start from L1. This cannot be undone once your L3 exam has started. Your
              learning progress won't be lost.
            </p>
            {error && <p className="mt-3 text-sm text-[#ff7a9c]">{error}</p>}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={switchPath.isPending}
                onClick={() => doSwitch("standard")}
                className="rounded-xl bg-gradient-to-r from-[#8a6eff] to-[#c45fff] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Yes, switch to Standard Path
              </button>
              <button
                type="button"
                onClick={() => setMode("menu")}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-[#b9a7ff]"
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
