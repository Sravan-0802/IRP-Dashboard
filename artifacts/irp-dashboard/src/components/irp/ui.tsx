import React from "react";
import { ClipboardList, Users, Lock, Trophy, RotateCcw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RingTone = "purple" | "blue" | "green" | "pink" | "gold";

const RING_STOPS: Record<RingTone, [string, string]> = {
  purple: ["#a855f7", "#ec4899"],
  blue: ["#818cf8", "#a855f7"],
  green: ["#22d3ee", "#a3e635"],
  pink: ["#f472b6", "#ec4899"],
  gold: ["#fbbf24", "#f472b6"],
};

const RING_TRACK: Record<RingTone, string> = {
  purple: "rgba(168,85,247,0.12)",
  blue: "rgba(129,140,248,0.12)",
  green: "rgba(34,211,238,0.12)",
  pink: "rgba(244,114,182,0.12)",
  gold: "rgba(251,191,36,0.12)",
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
          stroke={RING_TRACK[tone]}
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
          className="font-sans font-bold tabular-nums tracking-tight text-[#0d1117]"
          style={{ fontSize: size * 0.3 }}
        >
          {Math.round(v)}
          <span style={{ fontSize: size * 0.14 }} className="ml-0.5 font-semibold text-[#6e6a8a]">%</span>
        </span>
        {label && (
          <span
            className="mt-0.5 font-bold uppercase tracking-wide text-[#6e6a8a]"
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
  purple: "bg-[#eef2ff] text-[#3b5bdb] border border-[#3b5bdb]/[0.18]",
  green: "bg-[#d3f9d8] text-[#2b8a3e] border border-[#0ca678]/20",
  amber: "bg-[#fff9db] text-[#e67700] border border-[#f59f00]/20",
  grey: "bg-[#f1f3f5] text-[#aaa5c0] border border-[#dee2e6]",
  pink: "bg-[#fff0f6] text-[#c2255c] border border-[#e64980]/20",
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

export type StepIcon = "assessment" | "post" | "access";

export interface JourneyStep {
  label: string;
  status: StepStatus;
  icon: StepIcon;
}

const STEP_ICONS: Record<StepIcon, React.ComponentType<{ className?: string }>> = {
  assessment: ClipboardList,
  post: Users,
  access: Trophy,
};

export function JourneyBar({ steps }: { steps: JourneyStep[] }) {
  return (
    <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-0">
      <div className="absolute left-[16.7%] right-[16.7%] top-7 z-0 hidden h-0.5 bg-[#6741d9]/10 md:block" />
      {steps.map((step, i) => {
        const ring =
          step.status === "done"
            ? "border-[#0ca678] bg-[#d3f9d8] text-[#0ca678]"
            : step.status === "active"
              ? "border-[#3b5bdb] bg-[#3b5bdb] text-white shadow-[0_0_0_4px_rgba(59,91,219,0.15)]"
              : step.status === "reattempt"
                ? "border-dashed border-[#6741d9]/40 bg-[#eef2ff] text-[#6741d9]"
                : "border-[#dee2e6] bg-[#f1f3f5] text-[#aaa5c0]";
        const badge =
          step.status === "done"
            ? <Pill tone="green">Cleared</Pill>
            : step.status === "active"
              ? <Pill tone="purple">In Progress</Pill>
              : step.status === "reattempt"
                ? <Pill tone="purple">Reattempt</Pill>
                : <Pill tone="grey">Locked</Pill>;

        const StepIcon =
          step.status === "done"
            ? CheckCircle2
            : step.status === "locked"
              ? Lock
              : step.status === "reattempt"
                ? RotateCcw
                : STEP_ICONS[step.icon];

        return (
          <div
            key={`${step.label}-${i}`}
            className="relative z-10 flex items-start gap-4 md:w-1/3 md:flex-col md:items-center md:text-center"
          >
            <div
              className={cn(
                "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 md:mb-3",
                ring,
              )}
            >
              <StepIcon className="h-6 w-6" strokeWidth={2.25} />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#3b5bdb] shadow-[var(--shadow-sm)] ring-2 ring-white">
                {i + 1}
              </span>
            </div>
            <div className="min-w-0 flex-1 md:flex-none">
              <p className={cn("text-sm font-bold", step.status === "locked" ? "text-[#aaa5c0]" : "text-[#0d1117]")}>
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
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("irp-card", className)}>{children}</div>
  );
}
