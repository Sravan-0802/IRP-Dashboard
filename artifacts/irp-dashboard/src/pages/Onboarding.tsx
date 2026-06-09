import { useState } from "react";
import { Trophy, Zap, ArrowRight } from "lucide-react";
import { useCompleteOnboarding } from "@/lib/useJourney";
import { WildcardConfirm } from "@/components/irp/WildcardConfirm";

export default function Onboarding() {
  const [step, setStep] = useState<"select" | "wildcard-confirm">("select");
  const onboard = useCompleteOnboarding();

  function choose(path: "standard" | "wildcard") {
    onboard.mutate(path);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <span className="font-display text-sm font-bold uppercase tracking-[0.3em] text-[#8a6eff]">
          IRP 2.0
        </span>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-[#e8e6ff] sm:text-4xl">
          {step === "select" ? "Choose your path" : "One more thing"}
        </h1>
        {step === "select" && (
          <p className="mt-2 text-sm text-[#7a6eaa]">
            This sets up your journey. You can change it later from Settings.
          </p>
        )}
      </div>

      {step === "select" ? (
        <div className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
          {/* Standard Path */}
          <div className="irp-card flex flex-col p-6 transition-transform hover:-translate-y-1">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#8a6eff] to-[#c45fff] text-white">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a6eff]">
                  Standard Path
                </p>
                <h2 className="font-display text-xl font-extrabold text-[#e8e6ff]">
                  The Builder's Path 🏆
                </h2>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-[#a99fce]">
              Start from L1, build up through L2, reach L3. Structured, guided, step by step.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#7a6eaa]">
              <span className="rounded-md bg-white/[0.04] px-2 py-1">L1 · The Hustler</span>
              <ArrowRight className="h-3 w-3" />
              <span className="rounded-md bg-white/[0.04] px-2 py-1">L2 · The AI Architect</span>
              <ArrowRight className="h-3 w-3" />
              <span className="rounded-md bg-white/[0.04] px-2 py-1">L3 · Infinite Aura</span>
            </div>
            <button
              type="button"
              disabled={onboard.isPending}
              onClick={() => choose("standard")}
              className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8a6eff] to-[#c45fff] px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Start Standard Path
            </button>
          </div>

          {/* Wildcard */}
          <div className="irp-card relative flex flex-col overflow-hidden p-6 transition-transform hover:-translate-y-1">
            <span className="absolute right-4 top-4 rounded-full border border-[#ff6eb4]/30 bg-[#ff6eb4]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#ff9ccf]">
              Advanced only
            </span>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6eb4] to-[#c45fff] text-white">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#ff6eb4]">
                  Wildcard
                </p>
                <h2 className="font-display text-xl font-extrabold text-[#e8e6ff]">Direct L3 ⚡</h2>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-[#a99fce]">
              Skip straight to L3 assessment. No L1 or L2. High risk, high reward.
            </p>
            <button
              type="button"
              disabled={onboard.isPending}
              onClick={() => setStep("wildcard-confirm")}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-[#ff6eb4]/40 bg-[#ff6eb4]/10 px-5 py-3 text-sm font-bold text-[#ff9ccf] transition-colors hover:bg-[#ff6eb4]/20 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" /> Go Wildcard
            </button>
          </div>
        </div>
      ) : (
        <WildcardConfirm
          busy={onboard.isPending}
          onConfirm={() => choose("wildcard")}
          onCancel={() => choose("standard")}
        />
      )}
    </div>
  );
}
