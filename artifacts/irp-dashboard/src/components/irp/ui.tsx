import React from "react";
import { cn } from "@/lib/utils";

type RingTone = "purple" | "blue" | "green" | "pink" | "gold";

const RING_STOPS: Record<RingTone, [string, string]> = {
  purple: ["#8a6eff", "#c45fff"],
  blue: ["#5b8cff", "#8a6eff"],
  green: ["#1d9e75", "#46d39b"],
  pink: ["#ff6eb4", "#c45fff"],
  gold: ["#ffd24a", "#ffa500"],
};

export function ProgressRing({
  value,
  size = 76,
  strokeWidth = 8,
  tone = "purple",
  label,
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: RingTone;
  label?: string;
  className?: string;
}) {
  const v = Math.min(100, Math.max(0, value || 0));
  const radius = (size - strokeWidth) / 2;
  const circ = radius * 2 * Math.PI;
  const offset = circ - (v / 100) * circ;
  const id = React.useId();
  const [from, to] = RING_STOPS[tone];

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          stroke="rgba(138,110,255,0.14)"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          stroke={`url(#${id})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="font-display font-extrabold tabular-nums text-[#f4f2ff]"
          style={{ fontSize: size * 0.26 }}
        >
          {Math.round(v)}
          <span style={{ fontSize: size * 0.15 }} className="text-[#9a8fc4]">%</span>
        </span>
        {label && (
          <span
            className="mt-0.5 font-bold uppercase tracking-wide text-[#8a7fb6]"
            style={{ fontSize: size * 0.12 }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

type PillTone = "purple" | "green" | "amber" | "grey" | "pink";

const PILL_TONE: Record<PillTone, string> = {
  purple: "bg-[#8a6eff]/15 text-[#b9a7ff] border border-[#8a6eff]/30",
  green: "bg-[#1d9e75]/15 text-[#5fe0ad] border border-[#1d9e75]/30",
  amber: "bg-[#ffa500]/15 text-[#ffc564] border border-[#ffa500]/30",
  grey: "bg-white/5 text-[#7a6eaa] border border-white/10",
  pink: "bg-[#ff6eb4]/15 text-[#ff9ccf] border border-[#ff6eb4]/30",
};

export function Pill({
  tone = "purple",
  children,
  className,
}: {
  tone?: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide",
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type StepStatus = "done" | "active" | "locked" | "reattempt";

export interface JourneyStep {
  label: string;
  status: StepStatus;
  emoji: string;
}

export function JourneyBar({ steps }: { steps: JourneyStep[] }) {
  return (
    <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-0">
      <div className="absolute left-[16.7%] right-[16.7%] top-7 z-0 hidden border-t-2 border-dashed border-white/10 md:block" />
      {steps.map((step, i) => {
        const ring =
          step.status === "done"
            ? "border-[#1d9e75] bg-[#1d9e75]/15"
            : step.status === "active"
              ? "border-[#8a6eff] bg-[#8a6eff]/15 shadow-[0_0_20px_-2px_rgba(138,110,255,0.6)]"
              : step.status === "reattempt"
                ? "border-dashed border-[#ffa500] bg-[#ffa500]/10"
                : "border-white/10 bg-white/[0.03]";
        const badge =
          step.status === "done"
            ? <Pill tone="green">Cleared</Pill>
            : step.status === "active"
              ? <Pill tone="purple">In Progress</Pill>
              : step.status === "reattempt"
                ? <Pill tone="amber">Reattempt</Pill>
                : <Pill tone="grey">Locked</Pill>;
        return (
          <div
            key={`${step.label}-${i}`}
            className="relative z-10 flex items-start gap-4 md:w-1/3 md:flex-col md:items-center md:text-center"
          >
            <div
              className={cn(
                "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-xl md:mb-3",
                ring,
              )}
            >
              <span>{step.status === "reattempt" ? "↩️" : step.emoji}</span>
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0f0f1a] text-[10px] font-black text-[#b9a7ff] ring-2 ring-[#0f0f1a]">
                {i + 1}
              </span>
            </div>
            <div className="min-w-0 flex-1 md:flex-none">
              <p className={cn("text-sm font-bold", step.status === "locked" ? "text-[#4a4060]" : "text-[#e8e6ff]")}>
                {step.label}
              </p>
              <div className="mt-1.5">{badge}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function IrpCard({
  className,
  children,
  glow = false,
}: {
  className?: string;
  children: React.ReactNode;
  glow?: boolean;
}) {
  return (
    <div className={cn("irp-card", glow && "irp-glow", className)}>{children}</div>
  );
}
