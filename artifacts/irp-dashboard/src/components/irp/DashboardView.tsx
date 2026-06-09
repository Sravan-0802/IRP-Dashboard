import { FileText, Users, Lock, Brain, Code2, Mic, Zap, ArrowRight } from "lucide-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase } from "@/lib/journey";
import { Hero } from "./Hero";
import { JourneyBar, IrpCard, Pill, type JourneyStep } from "./ui";
import { ProgressSummary, type SubjectRow } from "./ProgressSummary";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-[#e8e6ff] sm:text-3xl">
          Welcome back, {firstName}! 👋
        </h1>
        <p className="mt-1 text-sm text-[#7a6eaa]">
          Here's exactly where you are in the IRP 2.0 journey.
        </p>
      </div>

      <Hero journey={journey} days={days} hours={hours} examDateLabel={examDateLabel} />

      {phase !== "PLACED" && (
        <IrpCard className="px-4 py-5 sm:px-6 md:px-8 md:py-6">
          <JourneyBar steps={journeySteps(journey)} />
        </IrpCard>
      )}

      {showRings(journey) && <ProgressSummary {...progress} />}

      {/* Post-assessment task cards */}
      {phase === "POST_ASSESSMENT" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <IrpCard className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7a6eaa]">Step 01</span>
              <Pill tone="amber">In Progress</Pill>
            </div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#8a6eff]/15 text-[#b9a7ff]">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-extrabold text-[#e8e6ff]">Project</h3>
            <p className="mt-1 text-sm text-[#a99fce]">
              Build and submit your project to unlock the mock interview.
            </p>
            <p className="mt-3 text-xs font-bold text-[#ffc564]">
              Due {journey.projectDueDate ?? "soon"}
            </p>
            <button className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8a6eff] to-[#c45fff] px-4 py-2.5 text-sm font-bold text-white">
              View Project Brief <ArrowRight className="h-4 w-4" />
            </button>
          </IrpCard>

          <IrpCard className={journey.projectSubmitted ? "p-5" : "p-5 opacity-70"}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7a6eaa]">Step 02</span>
              {journey.projectSubmitted ? <Pill tone="purple">Unlocked</Pill> : <Pill tone="grey">Locked</Pill>}
            </div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-[#7a6eaa]">
              {journey.projectSubmitted ? <Users className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <h3 className="font-display text-lg font-extrabold text-[#e8e6ff]">Mock Interview</h3>
            <p className="mt-1 text-sm text-[#a99fce]">
              {journey.projectSubmitted
                ? "Your interview is unlocked. Schedule it from the slot page."
                : "Unlocks after your project is submitted."}
            </p>
          </IrpCard>
        </div>
      )}

      {/* Wildcard: what L3 covers + opt-back */}
      {phase === "WILDCARD" && (
        <>
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#7a6eaa]">What L3 covers</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {L3_COVERS.map(({ icon: Icon, title, body }) => (
                <IrpCard key={title} className="p-5">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#ff6eb4]/15 text-[#ff9ccf]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-extrabold text-[#e8e6ff]">{title}</h3>
                  <p className="mt-1 text-sm text-[#a99fce]">{body}</p>
                </IrpCard>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-[#8a6eff]/25 bg-[#8a6eff]/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8a6eff]/20 text-[#b9a7ff]">
                <Zap className="h-5 w-5" />
              </div>
              <p className="text-sm text-[#cfc7ee]">
                Not feeling ready for L3 direct? You can switch to the standard path (L1 → L2 → L3)
                anytime before your exam starts. Your progress won't be lost.
              </p>
            </div>
            <button
              type="button"
              onClick={onSwitchToStandard}
              className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-[#e8e6ff] hover:bg-white/10"
            >
              Switch to standard path
            </button>
          </div>
        </>
      )}

      {/* Bottom strip: marks locked */}
      {(phase === "PREP" || phase === "EXAM_OPEN" || phase === "REATTEMPT_ACTIVE") && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4">
          <span className="text-xl">🔒</span>
          <p className="text-sm font-medium text-[#a99fce]">
            Marks locked — your scores unlock after the assessment on{" "}
            <span className="font-bold text-[#e8e6ff]">{examDateLabel}</span>.
          </p>
        </div>
      )}
      {phase === "REATTEMPT_WAITING" && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4">
          <span className="text-xl">🔒</span>
          <p className="text-sm font-medium text-[#a99fce]">
            Assessment scores locked until the reattempt window closes.
          </p>
        </div>
      )}
    </div>
  );
}
