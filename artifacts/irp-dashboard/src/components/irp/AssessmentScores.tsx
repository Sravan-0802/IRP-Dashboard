import { CheckCircle2, Lock, Clock, Trophy, Zap } from "lucide-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase, LEVEL_META } from "@/lib/journey";
import { IrpCard, Pill } from "./ui";

type Status = "cleared" | "pending" | "locked" | "skipped";

function statusFor(journey: Journey, n: 1 | 2 | 3): Status {
  const state = journey.journeyState;
  const cur = getLevel(state);
  // Any "_POST_*" state (post-assessment or post-reattempt) means the current
  // level's assessment has been cleared.
  const currentCleared = state.includes("_POST_");
  if (state === "PLACED") return "cleared";
  if (journey.isWildcard) {
    if (n < 3) return "skipped";
    return currentCleared ? "cleared" : "pending";
  }
  if (n < cur) return "cleared";
  if (n === cur) return currentCleared ? "cleared" : "pending";
  return "locked";
}

function pendingLabel(journey: Journey): string {
  switch (getPhase(journey.journeyState)) {
    case "EXAM_OPEN":
      return "In progress";
    case "REATTEMPT_WAITING":
      return "Reattempt soon";
    case "REATTEMPT_ACTIVE":
      return "Reattempt";
    default:
      return "Upcoming";
  }
}

const META: Record<
  Status,
  { pill: "green" | "purple" | "grey"; pillText: string; cardClass: string; iconClass: string }
> = {
  cleared: {
    pill: "green",
    pillText: "Cleared",
    cardClass: "border-[rgba(12,166,120,0.22)] bg-[#e8faf0]",
    iconClass: "bg-white/70 text-teal",
  },
  pending: {
    pill: "purple",
    pillText: "Upcoming",
    cardClass: "border-[rgba(59,91,219,0.2)] bg-l1-bg",
    iconClass: "bg-white/70 text-l1",
  },
  locked: {
    pill: "grey",
    pillText: "Locked",
    cardClass: "border-[#dee2e6] bg-[#f8f9fa]",
    iconClass: "bg-white/70 text-muted2",
  },
  skipped: {
    pill: "grey",
    pillText: "Skipped",
    cardClass: "border-[#dee2e6] bg-[#f8f9fa]",
    iconClass: "bg-white/70 text-muted2",
  },
};

function LevelCard({ journey, n }: { journey: Journey; n: 1 | 2 | 3 }) {
  const status = statusFor(journey, n);
  const m = META[status];
  const meta = LEVEL_META[n];
  const pillText = status === "pending" ? pendingLabel(journey) : m.pillText;
  const Icon =
    status === "cleared"
      ? CheckCircle2
      : status === "pending"
        ? Clock
        : status === "skipped"
          ? Zap
          : Lock;
  const muted = status === "locked" || status === "skipped";

  return (
    <div
      className={`hover-lift relative rounded-2xl border ${m.cardClass} p-4 shadow-soft ${
        status === "pending" ? "ring-2 ring-[rgba(59,91,219,0.22)]" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`text-[11px] font-bold uppercase tracking-wider ${muted ? "text-muted2" : "text-ink2"}`}
        >
          {meta.name}
        </span>
        <Pill tone={m.pill}>{pillText}</Pill>
      </div>
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${m.iconClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className={`font-display text-base font-extrabold ${muted ? "text-muted2" : "text-ink"}`}>
        {meta.tag}
      </h3>
      <p className="mt-1 text-sm text-muted2">
        {status === "cleared"
          ? "Assessment cleared."
          : status === "pending"
            ? "Score unlocks once this assessment is done."
            : status === "skipped"
              ? "Skipped via the Wildcard path."
              : "Unlocks after the previous level."}
      </p>
    </div>
  );
}

export function AssessmentScores({
  journey,
  examDateLabel,
}: {
  journey: Journey;
  examDateLabel: string;
}) {
  const phase = getPhase(journey.journeyState);
  const placed = phase === "PLACED";

  return (
    <IrpCard className="p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-1">
        <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-ink">
          <Trophy className="h-4 w-4 text-brand" /> Assessment Scores
        </h3>
        <p className="text-xs text-muted2">
          {placed
            ? "All assessments cleared — you're placed! 🎉"
            : "Your results across each IRP level. Scores unlock as you clear each assessment."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {([1, 2, 3] as const).map((n) => (
          <LevelCard key={n} journey={journey} n={n} />
        ))}
      </div>

      {(phase === "PREP" || phase === "EXAM_OPEN" || phase === "REATTEMPT_ACTIVE") && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[rgba(103,65,217,0.1)] bg-[rgba(248,247,255,0.8)] px-4 py-3">
          <Lock className="h-4 w-4 shrink-0 text-muted2" />
          <p className="text-xs font-medium text-muted2">
            Marks unlock after your assessment on{" "}
            <span className="font-bold text-ink">{examDateLabel}</span>.
          </p>
        </div>
      )}
      {phase === "REATTEMPT_WAITING" && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[rgba(103,65,217,0.1)] bg-[rgba(248,247,255,0.8)] px-4 py-3">
          <Lock className="h-4 w-4 shrink-0 text-muted2" />
          <p className="text-xs font-medium text-muted2">
            Scores stay locked until the reattempt window closes.
          </p>
        </div>
      )}
    </IrpCard>
  );
}
