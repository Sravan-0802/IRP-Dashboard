import { useState } from "react";
import {
  Brain,
  Code2,
  Mic,
  Zap,
  X,
  AlertTriangle,
} from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase, LEVEL_META } from "@/lib/journey";
import { getAssessmentStepStatus } from "@/lib/assessment";
import { l1HustlerJourneySteps } from "@/lib/l1JourneySteps";
import { Hero } from "./Hero";
import { JourneyBar, IrpCard, type JourneyStep } from "./ui";
import type { SubjectRow } from "./ProgressSummary";
import { AssessmentResults } from "./AssessmentResults";
import { ContactUs } from "./ContactUs";

function journeySteps(journey: Journey, assessments: AssessmentResult[]): JourneyStep[] {
  const phase = getPhase(journey.journeyState);
  const level = getLevel(journey.journeyState);

  if (level === 1 && !journey.isWildcard) {
    return l1HustlerJourneySteps(journey, assessments);
  }

  const assessmentStatus = getAssessmentStepStatus(assessments, level);

  if (phase === "WILDCARD") {
    return [
      { label: "L3 Exam", status: "active", icon: "assessment" },
      { label: "Project", status: "locked", icon: "post" },
      { label: "Interview", status: "locked", icon: "access" },
    ];
  }
  if (phase === "PLACED") {
    return [
      { label: "Assessment", status: "done", icon: "assessment" },
      { label: "Post-Assessment", status: "done", icon: "post" },
      { label: "Placed", status: "done", icon: "access" },
    ];
  }
  if (phase === "POST_ASSESSMENT") {
    return [
      { label: "Online Assessment", status: assessmentStatus, icon: "assessment" },
      { label: "Post-Assessment", status: "active", icon: "post" },
      { label: `Level ${level} Access`, status: "locked", icon: "access" },
    ];
  }

  const onlineAssessmentStatus: JourneyStep["status"] =
    phase === "REATTEMPT_WAITING"
      ? "reattempt"
      : assessmentStatus;

  return [
    { label: "Online Assessment", status: onlineAssessmentStatus, icon: "assessment" },
    { label: "Post-Assessment", status: "locked", icon: "post" },
    { label: `Level ${level} Access`, status: "locked", icon: "access" },
  ];
}

function assessmentMotivation(
  phase: ReturnType<typeof getPhase>,
  days: number,
  points: number,
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
): string {

  const assessmentStatus = getAssessmentStepStatus(assessments, level);

  switch (phase) {
    case "EXAM_OPEN":
      return "It's go time. Give it everything — this is your moment. 🔥";
    case "POST_ASSESSMENT":
      return assessmentStatus === "done"
        ? "Assessment cleared. Finish your tasks and keep the momentum rolling. 💪"
        : assessmentStatus === "attempted_not_cleared"
          ? "You attempted the assessment but didn't clear yet. Review your results and keep pushing. 💪"
          : "Assessment attempted. Review your results and keep building for the next round. 💪";
    case "PLACED":
      return "You did it. Take it in — you've earned this. 🎉";
    case "REATTEMPT_WAITING":
    case "REATTEMPT_ACTIVE":
      return "One setback doesn't define you. Round 2 is where comebacks happen. 💥";
    case "WILDCARD":
      return "You're on the fast track. Big risk, bigger reward — let's go. ⚡";
    default:
      return days > 0
        ? `${days} ${days === 1 ? "day" : "days"} until you level up. You've banked ${points.toLocaleString()} pts — keep stacking. 🔥`
        : "";
  }
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
  examDateLabel,
  progress,
  assessments,
  onSwitchToStandard,
  onOpenAssessmentCalendar,
}: {
  journey: Journey;
  firstName: string;
  days: number;
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
  assessments: AssessmentResult[];
  onSwitchToStandard: () => void;
  onOpenAssessmentCalendar?: () => void;
}) {
  const phase = getPhase(journey.journeyState);
  const level = getLevel(journey.journeyState);

  const motivation = assessmentMotivation(phase, days, progress.points, assessments, level);

  const DISCLAIMER_KEY = "irp_disclaimer_dismissed";
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISCLAIMER_KEY) === "1"; } catch { return false; }
  });
  const dismissDisclaimer = () => {
    try { sessionStorage.setItem(DISCLAIMER_KEY, "1"); } catch { /* ignore */ }
    setDisclaimerDismissed(true);
  };

  const showDisclaimer = !disclaimerDismissed;

  return (
    <div className="space-y-6">
      {showDisclaimer && (
        <div className="animate-pop-in relative flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 pr-10 sm:px-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-amber-900">Platform Notice</p>
            <p className="mt-0.5 text-sm text-amber-800">
              We are facing some product issues with our platform.{" "}
              <span className="font-semibold">Your attempt won&apos;t be missed!</span>{" "}
              We will ensure that you get a chance to attempt your{" "}
              <span className="font-semibold">FE Project</span>.{" "}
              Thank you for your patience!
            </p>
          </div>
          <button
            type="button"
            onClick={dismissDisclaimer}
            aria-label="Dismiss notice"
            className="absolute right-3 top-3 rounded-lg p-1 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="animate-pop-in">
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
          Welcome back, {firstName}! <span className="inline-block animate-float-soft">👋</span>
        </h1>
        {motivation ? (
          <p className="mt-1.5 text-sm font-medium text-muted2">{motivation}</p>
        ) : null}
      </div>

      <Hero journey={journey} days={days} examDateLabel={examDateLabel} assessments={assessments} />

      <IrpCard className="px-3 py-4 sm:px-5 sm:py-5 md:px-6 md:py-5">
        {level === 1 && !journey.isWildcard && (
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-muted2 md:text-left">
            {LEVEL_META[1].name} · {LEVEL_META[1].tag}
          </p>
        )}
        <JourneyBar
          steps={journeySteps(journey, assessments)}
          compact={level === 1 && !journey.isWildcard}
          onAssessmentCalendarClick={onOpenAssessmentCalendar}
        />
      </IrpCard>

      <AssessmentResults journey={journey} examDateLabel={examDateLabel} assessments={assessments} />

      <ContactUs />

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
