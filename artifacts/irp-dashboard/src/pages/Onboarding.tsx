import { useState } from "react";
import { ArrowRight } from "lucide-react";
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
        <span className="font-display text-sm font-bold uppercase tracking-[0.3em] text-brand">
          IRP 2.0
        </span>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">
          {step === "select" ? "How do you want to take on IRP 2.0?" : "One more thing"}
        </h1>
        {step === "select" && (
          <p className="mt-2 text-sm text-muted2">
            Choose your path. You can switch later from your profile.
          </p>
        )}
      </div>

      {step === "select" ? (
        <div className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
          {/* Standard Path */}
          <div className="flex flex-col rounded-[20px] border border-[rgba(59,91,219,0.12)] bg-white p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-[rgba(59,91,219,0.3)] hover:shadow-soft-md">
            <div className="text-5xl">🏆</div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-l1">
              Standard Path
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold text-ink">
              The Builder's Path
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted2">
              Start from L1, build up through L2, reach L3. Structured, guided, step by step.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="rounded-md border border-[rgba(59,91,219,0.18)] bg-l1-bg px-2 py-1 text-l1">L1 · The Hustler</span>
              <ArrowRight className="h-3 w-3 text-dim" />
              <span className="rounded-md border border-[rgba(245,159,0,0.2)] bg-l2-bg px-2 py-1 text-l2-text">L2 · The Main Character</span>
              <ArrowRight className="h-3 w-3 text-dim" />
              <span className="rounded-md border border-[rgba(230,73,128,0.2)] bg-l3-bg px-2 py-1 text-l3-text">L3 · Infinite Aura</span>
            </div>
            <button
              type="button"
              disabled={onboard.isPending}
              onClick={() => choose("standard")}
              className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-l1 px-5 py-3 font-display text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Start Standard Path
            </button>
          </div>

          {/* Wildcard */}
          <div className="relative flex flex-col overflow-hidden rounded-[20px] border border-[rgba(230,73,128,0.15)] bg-white p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-[rgba(230,73,128,0.3)] hover:shadow-soft-md">
            <span className="absolute right-4 top-4 rounded-full border border-[rgba(245,159,0,0.2)] bg-l2-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-l2-text">
              Advanced students only
            </span>
            <div className="text-5xl">⚡</div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-l3">
              Wildcard
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold text-ink">Direct L3</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted2">
              Skip straight to L3 assessment. No L1 or L2. High risk, high reward.
            </p>
            <button
              type="button"
              disabled={onboard.isPending}
              onClick={() => setStep("wildcard-confirm")}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-display text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(90deg,#9c36b5,#e64980)" }}
            >
              Go Wildcard
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
