import { ArrowRight } from "lucide-react";
import { useCompleteOnboarding } from "@/lib/useJourney";

export default function Onboarding() {
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
          Welcome to IRP 2.0
        </h1>
        <p className="mt-2 text-sm text-muted2">
          Here's how your journey is structured. Let's get started.
        </p>
      </div>

      <div className="w-full max-w-md">
        {/* Standard Path */}
        <div className="flex flex-col rounded-[20px] border border-[rgba(59,91,219,0.12)] bg-white p-6 shadow-soft">
          <div className="text-5xl">🏆</div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-l1">
            Your Path
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
            Let's go
          </button>
        </div>
      </div>
    </div>
  );
}
