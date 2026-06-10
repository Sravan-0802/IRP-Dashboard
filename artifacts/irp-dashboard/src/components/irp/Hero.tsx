import { CheckCircle2, CalendarClock } from "lucide-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase, LEVEL_META } from "@/lib/journey";
import { CountdownRing } from "./CountdownRing";

const LEVEL_EMOJI: Record<1 | 2 | 3, string> = { 1: "💪", 2: "🤖", 3: "⚡" };

function PulsingDot({ color }: { color: string }) {
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
  examDateLabel,
  overallPct = 0,
  points = 0,
}: {
  journey: Journey;
  days: number;
  examDateLabel: string;
  overallPct?: number;
  points?: number;
}) {
  const phase = getPhase(journey.journeyState);
  const level = getLevel(journey.journeyState);
  const meta = LEVEL_META[level];

  // ── WILDCARD ──
  if (phase === "WILDCARD") {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(156,54,181,0.2)] p-6 shadow-soft sm:p-8"
        style={{ background: "linear-gradient(130deg, #f8f0ff, #fff0f9)" }}
      >
        <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <div className="text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(156,54,181,0.25)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-2">
              <PulsingDot color="#9c36b5" /> Wildcard Path — Active
            </div>
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Infinite Aura: L3 Direct
            </h2>
            <p className="mt-1 text-sm font-medium text-muted2">{examDateLabel} • L3 Assessment</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted2">Assessment Countdown</p>
            <CountdownRing value={days} unit="Days" tone="pink" />
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#6e6a8a]">Days</p>
          </div>
        </div>
      </div>
    );
  }

  // ── PLACED ──
  if (phase === "PLACED") {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(12,166,120,0.25)] p-8 text-center shadow-soft"
        style={{ background: "linear-gradient(130deg, #e8faf0, #f0fff8)" }}
      >
        <div className="text-5xl">🎉</div>
        <h2 className="mt-3 font-display text-3xl font-extrabold text-ink">You're placed!</h2>
        <p className="mt-2 text-sm text-muted2">Congratulations on completing the IRP 2.0 journey.</p>
      </div>
    );
  }

  // ── POST_ASSESSMENT (cleared) ──
  if (phase === "POST_ASSESSMENT") {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(12,166,120,0.25)] p-6 shadow-soft sm:p-8"
        style={{ background: "linear-gradient(130deg, #e8faf0, #f0fff8)" }}
      >
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <div className="text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(12,166,120,0.3)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal">
              <PulsingDot color="#0ca678" /> {meta.name} Assessment — Cleared
            </div>
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Post-Assessment is live
            </h2>
            <p className="mt-1 text-sm font-medium text-muted2">
              Complete your project, then unlock the mock interview.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-[rgba(12,166,120,0.25)] bg-[#d3f9d8] px-6 py-5">
            <span className="text-2xl">✅</span>
            <p className="font-display text-base font-extrabold text-teal">{meta.name} Cleared</p>
          </div>
        </div>
      </div>
    );
  }

  // ── REATTEMPT_WAITING (neutral, no failure language, no red) ──
  if (phase === "REATTEMPT_WAITING") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[rgba(103,65,217,0.15)] bg-[rgba(255,255,255,0.92)] p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(103,65,217,0.2)] bg-[rgba(103,65,217,0.06)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
              Reattempt
            </div>
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Your next attempt is coming up
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted2">
              This round didn't go through — that happens. Next attempt window opens on{" "}
              <span className="font-bold text-ink">{journey.reattemptDate ?? examDateLabel}</span>.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-[rgba(59,91,219,0.18)] bg-l1-bg px-6 py-5">
            <CalendarClock className="h-6 w-6 text-l1" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-l1">Next attempt</p>
            <p className="font-display text-base font-extrabold text-ink">
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
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(12,166,120,0.25)] p-6 shadow-soft sm:p-8"
        style={{ background: "linear-gradient(130deg, #e8faf0, #f0fff8)" }}
      >
        <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <div className="text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(12,166,120,0.3)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal">
              <PulsingDot color="#0ca678" /> Assessment is LIVE
            </div>
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              {meta.name}: {meta.tag}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted2">
              {days} {days === 1 ? "day" : "days"} remaining
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted2">Closes In</p>
            <CountdownRing value={days} unit="Days" total={14} tone="teal" />
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#6e6a8a]">Days</p>
          </div>
        </div>
      </div>
    );
  }

  // ── PREP & REATTEMPT_ACTIVE (default — upcoming assessment) ──
  const isReattemptActive = phase === "REATTEMPT_ACTIVE";
  const nextLevel = level < 3 ? LEVEL_META[(level + 1) as 1 | 2 | 3] : null;
  const soon = days <= 7;
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[rgba(103,65,217,0.16)] p-4 shadow-soft-md animate-pop-in sm:p-5"
      style={{ background: "linear-gradient(125deg, #eef2ff 0%, #f3ecff 45%, #ffeef7 100%)" }}
    >
      {/* glowing aura orbs */}
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(103,65,217,0.28),transparent_70%)] blur-2xl animate-glow-pulse" />
      <div
        className="pointer-events-none absolute -bottom-28 left-1/4 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(230,73,128,0.2),transparent_70%)] blur-2xl animate-glow-pulse"
        style={{ animationDelay: "1.4s" }}
      />
      <div className="relative flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
          <div className="select-none text-5xl drop-shadow-sm animate-float-soft">
            {isReattemptActive ? "🔁" : "🚀"}
          </div>
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[rgba(59,91,219,0.22)] bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-l1 backdrop-blur">
              <PulsingDot color="#3b5bdb" /> {isReattemptActive ? "Round 2 — You've got this" : "Your next mission"}
            </div>
            <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted2">
              {meta.name} {LEVEL_EMOJI[level]}
            </p>
            <h2 className="font-display text-2xl font-extrabold leading-[1.05] sm:text-3xl">
              <span className="shimmer-text">{meta.tag}</span>
            </h2>
            <p className="mt-1.5 max-w-sm text-xs font-medium text-muted2">
              {nextLevel ? (
                <>
                  Clear this assessment to unlock{" "}
                  <span className="font-bold text-ink">{nextLevel.name}: {nextLevel.tag}</span>.
                </>
              ) : (
                <>Clear this to lock in your placement — the finish line is right there.</>
              )}
            </p>
          </div>
        </div>
        {/* Right: date chip → ring → days → stats */}
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(103,65,217,0.18)] bg-white/70 px-3 py-1 text-[11px] font-bold text-brand backdrop-blur">
            <CalendarClock className="h-3 w-3" /> {examDateLabel}
          </span>
          <CountdownRing value={days} unit="Days" tone="blue" size={90} />
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#6e6a8a]">Days</p>
          <div className="flex items-center gap-3 rounded-xl border border-[rgba(103,65,217,0.14)] bg-white/70 px-3 py-2 backdrop-blur">
            <div className="text-center">
              <p className="font-display text-sm font-black leading-none text-l1">{overallPct}%</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-dim">Overall</p>
            </div>
            <div className="h-6 w-px bg-[rgba(103,65,217,0.14)]" />
            <div className="text-center">
              <p className="font-display text-sm font-black leading-none text-brand">{points.toLocaleString()}</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-dim">pts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
