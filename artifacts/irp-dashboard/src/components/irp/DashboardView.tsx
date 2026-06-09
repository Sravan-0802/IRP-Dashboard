import { FileText, Users, Lock, Brain, Code2, Mic, Zap, ArrowRight } from "lucide-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase } from "@/lib/journey";
import { Hero } from "./Hero";
import { JourneyBar, IrpCard, Pill, type JourneyStep } from "./ui";
import { ProgressSummary, type SubjectRow } from "./ProgressSummary";
import { AssessmentScores } from "./AssessmentScores";

function journeySteps(journey: Journey): JourneyStep[] {
  const phase = getPhase(journey.journeyState);
  const level = getLevel(journey.journeyState);

  if (phase === "WILDCARD") {
    return [
      { label: "L3 Exam", status: "active", emoji: "📝" },
      { label: "Project", status: "locked", emoji: "🛠️" },
      { label: "Interview", status: "locked", emoji: "🎤" },
    ];
  }
  if (phase === "PLACED") {
    return [
      { label: "Assessment", status: "done", emoji: "📋" },
      { label: "Post-Assessment", status: "done", emoji: "👥" },
      { label: "Placed", status: "done", emoji: "🏆" },
    ];
  }
  if (phase === "POST_ASSESSMENT") {
    return [
      { label: "Online Assessment", status: "done", emoji: "📋" },
      { label: "Post-Assessment", status: "active", emoji: "👥" },
      { label: `Level ${level} Access`, status: "locked", emoji: "🔒" },
    ];
  }
  const first: JourneyStep["status"] = phase === "REATTEMPT_WAITING" ? "reattempt" : "active";
  return [
    { label: "Online Assessment", status: first, emoji: "📋" },
    { label: "Post-Assessment", status: "locked", emoji: "👥" },
    { label: `Level ${level} Access`, status: "locked", emoji: "🔒" },
  ];
}

function showRings(journey: Journey): boolean {
  const phase = getPhase(journey.journeyState);
  return phase !== "POST_ASSESSMENT" && phase !== "PLACED";
}

const L3_COVERS = [
  { icon: Code2, title: "Full-stack concepts", body: "Frontend, backend, databases & APIs end to end." },
  { icon: Brain, title: "DSA + Python", body: "Data structures up to Level 4 and problem solving." },
  { icon: Mic, title: "Interview round", body: "A technical interview to validate your depth." },
];

export function DashboardView({
  journey,
  firstName,
  days,
  hours,
  examDateLabel,
  progress,
  onSwitchToStandard,
}: {
  journey: Journey;
  firstName: string;
  days: number;
  hours: number;
  examDateLabel: string;
  progress: {
    overallPct: number;
    mcqPct: number;
    codingPct: number;
    mcqDone: number;
    mcqTotal: number;
    codingDone: number;
    codingTotal: number;
    points: number;
    maxPoints: number;
    subjects: SubjectRow[];
  };
  onSwitchToStandard: () => void;
}) {
  const phase = getPhase(journey.journeyState);

  const motivation = (() => {
    switch (phase) {
      case "EXAM_OPEN":
        return "It's go time. Give it everything — this is your moment. 🔥";
      case "POST_ASSESSMENT":
        return "Assessment cleared. Finish your tasks and keep the momentum rolling. 💪";
      case "PLACED":
        return "You did it. Take it in — you've earned this. 🎉";
      case "REATTEMPT_WAITING":
      case "REATTEMPT_ACTIVE":
        return "One setback doesn't define you. Round 2 is where comebacks happen. 💥";
      case "WILDCARD":
        return "You're on the fast track. Big risk, bigger reward — let's go. ⚡";
      default:
        return days > 0
          ? `${days} ${days === 1 ? "day" : "days"} until you level up. You've banked ${progress.points.toLocaleString()} pts — keep stacking. 🔥`
          : "Your next mission is loading. Time to lock in. 🔥";
    }
  })();

  return (
    <div className="space-y-6">
      <div className="animate-pop-in">
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
          Welcome back, {firstName}! <span className="inline-block animate-float-soft">👋</span>
        </h1>
        <p className="mt-1.5 text-sm font-medium text-muted2">{motivation}</p>
      </div>

      <Hero journey={journey} days={days} hours={hours} examDateLabel={examDateLabel} overallPct={progress.overallPct} points={progress.points} />

      {phase !== "PLACED" && (
        <IrpCard className="px-4 py-5 sm:px-6 md:px-8 md:py-6">
          <JourneyBar steps={journeySteps(journey)} />
        </IrpCard>
      )}

      {showRings(journey) && <ProgressSummary {...progress} />}

      <AssessmentScores journey={journey} examDateLabel={examDateLabel} />

      {/* Post-assessment task cards */}
      {phase === "POST_ASSESSMENT" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[rgba(59,91,219,0.22)] bg-l1-bg p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-l1">Step 01</span>
              <Pill tone="purple">In Progress</Pill>
            </div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/70 text-l1">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-extrabold text-ink">Project</h3>
            <p className="mt-1 text-sm text-muted2">
              Build and submit your project to unlock the mock interview.
            </p>
            <p className="mt-3 text-xs font-bold text-l2-text">
              Due {journey.projectDueDate ?? "soon"}
            </p>
            <button className="mt-4 flex items-center gap-2 rounded-xl bg-l1 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
              View Project Brief <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div
            className={
              journey.projectSubmitted
                ? "rounded-2xl border border-[rgba(59,91,219,0.22)] bg-l1-bg p-5 shadow-soft"
                : "rounded-2xl border border-[#dee2e6] bg-[#f8f9fa] p-5 shadow-soft"
            }
          >
            <div className="mb-3 flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${journey.projectSubmitted ? "text-l1" : "text-dim"}`}>Step 02</span>
              {journey.projectSubmitted ? <Pill tone="purple">Unlocked</Pill> : <Pill tone="grey">Locked</Pill>}
            </div>
            <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${journey.projectSubmitted ? "bg-white/70 text-l1" : "bg-white/60 text-dim"}`}>
              {journey.projectSubmitted ? <Users className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <h3 className={`font-display text-lg font-extrabold ${journey.projectSubmitted ? "text-ink" : "text-muted2"}`}>Mock Interview</h3>
            <p className={`mt-1 text-sm ${journey.projectSubmitted ? "text-muted2" : "text-dim"}`}>
              {journey.projectSubmitted
                ? "Your interview is unlocked. Schedule it from the slot page."
                : "Unlocks after your project is submitted."}
            </p>
          </div>
        </div>
      )}

      {/* Wildcard: what L3 covers + opt-back */}
      {phase === "WILDCARD" && (
        <>
          <div>
            <p className="section-label mb-3 text-muted2">What L3 covers</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {L3_COVERS.map(({ icon: Icon, title, body }) => (
                <IrpCard key={title} className="p-5">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-l3-bg text-l3">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-extrabold text-ink">{title}</h3>
                  <p className="mt-1 text-sm text-muted2">{body}</p>
                </IrpCard>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-[rgba(230,73,128,0.15)] bg-l3-bg p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-l3">
                <Zap className="h-5 w-5" />
              </div>
              <p className="text-sm text-ink2">
                Not feeling ready for L3 direct? You can switch to the standard path (L1 → L2 → L3)
                anytime before your exam starts. Your progress won't be lost.
              </p>
            </div>
            <button
              type="button"
              onClick={onSwitchToStandard}
              className="shrink-0 rounded-xl border border-[rgba(230,73,128,0.4)] bg-white/70 px-4 py-2.5 text-sm font-bold text-l3-text transition-colors hover:bg-white"
            >
              Switch to standard path
            </button>
          </div>
        </>
      )}
    </div>
  );
}
