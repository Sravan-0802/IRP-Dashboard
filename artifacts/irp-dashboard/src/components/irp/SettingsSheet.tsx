import { useState } from "react";
import { X, Trophy } from "lucide-react";
import type { Journey } from "@/lib/journey";
import { useSwitchPath } from "@/lib/useJourney";

export function SettingsSheet({
  journey,
  open,
  onClose,
  initialMode = "menu",
}: {
  journey: Journey;
  open: boolean;
  onClose: () => void;
  initialMode?: "menu" | "to-standard";
}) {
  const [mode, setMode] = useState<"menu" | "to-standard">(initialMode);
  const switchPath = useSwitchPath();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function close() {
    setMode("menu");
    setError(null);
    onClose();
  }

  function doSwitch() {
    setError(null);
    switchPath.mutate("standard", {
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

                {journey.isWildcard && (
                  <button
                    type="button"
                    onClick={() => setMode("to-standard")}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-l1 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  >
                    <Trophy className="h-4 w-4" /> Switch to Standard Path
                  </button>
                )}
              </div>
            </section>

            {error && <p className="text-sm text-red">{error}</p>}
          </div>
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
                onClick={doSwitch}
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
