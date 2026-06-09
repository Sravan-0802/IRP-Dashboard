import { Clock, Zap, ArrowRight, CheckCircle2, CalendarClock } from "lucide-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase, LEVEL_META } from "@/lib/journey";
import { CountdownRing } from "./CountdownRing";

function PulsingDot({ tone }: { tone: "purple" | "green" }) {
  const color = tone === "green" ? "#46d39b" : "#c45fff";
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: color }} />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function Hero({
  journey,
  days,
  hours,
  examDateLabel,
}: {
  journey: Journey;
  days: number;
  hours: number;
  examDateLabel: string;
}) {
  const phase = getPhase(journey.journeyState);
  const level = getLevel(journey.journeyState);
  const meta = LEVEL_META[level];

  // ── WILDCARD ──
  if (phase === "WILDCARD") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#ff6eb4]/25 bg-gradient-to-br from-[#3a1145] via-[#2a1257] to-[#1a1140] p-6 sm:p-8">
        <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <div className="text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ff6eb4]/30 bg-[#ff6eb4]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#ff9ccf]">
              <Zap className="h-3 w-3" /> Wildcard Path — Active
            </div>
            <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
              Infinite Aura: L3 Direct
            </h2>
            <p className="mt-1 text-sm font-medium text-white/70">{examDateLabel} • L3 Assessment</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Assessment Countdown</p>
            <CountdownRing value={days} unit="Days" tone="amber" />
          </div>
        </div>
      </div>
    );
  }

  // ── PLACED ──
  if (phase === "PLACED") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#1d9e75]/30 bg-gradient-to-br from-[#0c3a2a] via-[#10402f] to-[#0b2a40] p-8 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="mt-3 font-display text-3xl font-extrabold text-white">You're placed!</h2>
        <p className="mt-2 text-sm text-white/70">Congratulations on completing the IRP 2.0 journey.</p>
      </div>
    );
  }

  // ── POST_ASSESSMENT (cleared) ──
  if (phase === "POST_ASSESSMENT") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#1d9e75]/30 bg-gradient-to-r from-[#0c3a2a] via-[#0f4733] to-[#103f46] p-6 sm:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#46d39b]/30 bg-[#46d39b]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#7fe9bd]">
          <CheckCircle2 className="h-3 w-3" /> {meta.name} Assessment — Cleared
        </div>
        <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
          Post-Assessment is live
        </h2>
        <p className="mt-1 text-sm font-medium text-white/70">
          Complete your project, then unlock the mock interview.
        </p>
      </div>
    );
  }

  // ── REATTEMPT_WAITING (neutral, no failure language) ──
  if (phase === "REATTEMPT_WAITING") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#8a6eff]/35 bg-[#11112099] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#8a6eff]/30 bg-[#8a6eff]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#b9a7ff]">
              <Clock className="h-3 w-3" /> Reattempt
            </div>
            <h2 className="font-display text-2xl font-extrabold text-[#e8e6ff] sm:text-3xl">
              Your next attempt is coming up
            </h2>
            <p className="mt-2 max-w-md text-sm text-[#a99fce]">
              This round didn't go through — that happens. Next attempt window opens on{" "}
              <span className="font-bold text-[#e8e6ff]">{journey.reattemptDate ?? examDateLabel}</span>.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#8a6eff]/25 bg-[#8a6eff]/10 px-6 py-5">
            <CalendarClock className="h-6 w-6 text-[#b9a7ff]" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#7a6eaa]">Next attempt</p>
            <p className="font-display text-lg font-extrabold text-[#e8e6ff]">
              {journey.reattemptDate ?? examDateLabel}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── EXAM_OPEN (live) ──
  if (phase === "EXAM_OPEN") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#1d9e75]/30 bg-gradient-to-r from-[#0c3a2a] via-[#11402f] to-[#13313f] p-6 sm:p-8">
        <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <div className="text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#46d39b]/30 bg-[#46d39b]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#7fe9bd]">
              <PulsingDot tone="green" /> Assessment is LIVE
            </div>
            <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
              {meta.name}: {meta.tag}
            </h2>
            <p className="mt-1 text-sm font-medium text-white/70">{hours} hours remaining</p>
            <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1d9e75] to-[#46d39b] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
              Attempt Now <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Closes In</p>
            <CountdownRing value={hours} unit="Hours" total={48} tone="green" />
          </div>
        </div>
      </div>
    );
  }

  // ── PREP & REATTEMPT_ACTIVE (default purple) ──
  const isReattemptActive = phase === "REATTEMPT_ACTIVE";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#8a6eff]/25 bg-gradient-to-r from-[#3b1d8a] via-[#4a23a8] to-[#5b21b6] p-6 sm:p-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />
      <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="select-none text-5xl sm:text-6xl">🚀</div>
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              <PulsingDot tone="purple" /> {isReattemptActive ? "Round 2 — Reattempt" : "Upcoming Assessment"}
            </div>
            <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
              {meta.name}: {meta.tag}
            </h2>
            <p className="mt-1 text-sm font-medium text-white/75">{examDateLabel} • IRP Assessment</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Assessment Countdown</p>
          <CountdownRing value={days} unit="Days" tone="amber" />
        </div>
      </div>
    </div>
  );
}
