import { CalendarClock, ClipboardList, ExternalLink, FileCode2, ShieldCheck, UserRound } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase, LEVEL_META } from "@/lib/journey";
import {
  areAssignmentResultsVisible,
  isAssessmentLive,
  isExamWindowClosed,
  isL1July12AssessmentLive,
} from "@/lib/irpDates";
import {
  getAssessmentStepStatus,
  assessmentOverallPct,
  hasAttemptedL1Cycle2,
  hasClearedAssessment,
  hasClearedFeProject,
  pickAssessmentForLevel,
  pickL1AssessmentForResults,
} from "@/lib/assessment";
import {
  formatL1OnlineStatus,
} from "@/lib/studentStatusDisplay";
import {
  isCycle1Cleared,
  isCycle2Candidate,
} from "@/lib/l1StudentTrack";
import {
  getL1PipelineStage,
  l1StageHeroContent,
  type L1PipelineStage,
} from "@/lib/l1PipelineStage";
import { useVisibilitySettings } from "@/lib/useVisibilitySettings";
import { useStudentAccess } from "@/lib/useStudentAccess";
import { CountdownRing } from "./CountdownRing";
import { Pill } from "./ui";

const LEVEL_EMOJI: Record<1 | 2 | 3, string> = { 1: "💪", 2: "🤖", 3: "⚡" };

const LEVEL_HEADING_CLASS =
  "mb-2 font-display text-xl font-extrabold text-ink sm:text-2xl";

function LevelHeading({ name, level }: { name: string; level: 1 | 2 | 3 }) {
  return (
    <p className={LEVEL_HEADING_CLASS}>
      {name} {LEVEL_EMOJI[level]}
    </p>
  );
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: color }} />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

function ClearedAssessmentHero({
  level,
  statusLabel = "Qualified",
}: {
  level: 1 | 2 | 3;
  statusLabel?: string;
}) {
  const meta = LEVEL_META[level];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[rgba(12,166,120,0.25)] p-5 shadow-soft sm:p-6 md:p-8"
      style={{ background: "linear-gradient(130deg, #e8faf0, #f0fff8)" }}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(12,166,120,0.3)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal">
            <PulsingDot color="#0ca678" /> Assessment completed
          </div>
          <LevelHeading name={meta.name} level={level} />
          <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
            You cleared the online assessment
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted2">
            Great work — continue with the next steps in your IRP journey below.
          </p>
        </div>

        <div className="relative flex shrink-0 flex-col items-center gap-3 lg:items-end">
          <span className="genz-badge inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-teal">
            {statusLabel}
          </span>
          <div className="relative flex h-28 w-36 items-center justify-center sm:h-32 sm:w-44" aria-hidden>
            <ShieldCheck className="h-20 w-20 text-[#0ca678]/90" strokeWidth={1.25} />
            <ClipboardList className="absolute bottom-0 right-0 h-14 w-14 text-[#12b886]/85" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </div>
  );
}

function L1PipelineStageHero({
  level,
  stage,
  ctaUrl,
  ctaLabel,
}: {
  level: 1 | 2 | 3;
  stage: L1PipelineStage;
  ctaUrl?: string | null;
  ctaLabel?: string;
}) {
  const meta = LEVEL_META[level];
  const content = l1StageHeroContent(stage);

  const StageIcon =
    stage === "fe_project_active" || stage === "fe_project_not_cleared"
      ? FileCode2
      : stage === "human_interview_active"
        ? UserRound
        : ShieldCheck;

  const iconColor =
    stage === "human_interview_active"
      ? "text-[#3b5bdb]/90"
      : stage === "fe_project_not_cleared"
        ? "text-[#e67700]/90"
        : "text-[#0ca678]/90";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-soft sm:p-6 md:p-8 ${content.borderClass}`}
      style={{ background: content.background }}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div
            className={`mb-3 inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${content.eyebrowClass}`}
          >
            <PulsingDot color={content.dotColor} /> {content.eyebrow}
          </div>
          <LevelHeading name={meta.name} level={level} />
          <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
            {content.title}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted2">{content.body}</p>
          {ctaUrl ? (
            <a
              href={ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pop mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
            >
              <ExternalLink className="h-4 w-4" />
              {ctaLabel ?? "Open link"}
            </a>
          ) : null}
        </div>

        <div className="relative flex shrink-0 flex-col items-center gap-3 lg:items-end">
          <span className="genz-badge inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-ink">
            {content.statusBadge}
          </span>
          <div className="relative flex h-28 w-36 items-center justify-center sm:h-32 sm:w-44" aria-hidden>
            <StageIcon className={`h-20 w-20 ${iconColor}`} strokeWidth={1.25} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero({
  journey,
  days,
  examDateLabel: _examDateLabel,
  assessments = [],
  nxtmock: _nxtmock,
  feProjectMinScore,
  userId,
}: {
  journey: Journey;
  days: number;
  examDateLabel: string;
  assessments?: AssessmentResult[];
  nxtmock?: unknown;
  feProjectMinScore?: number | null;
  userId?: string;
}) {
  const { settings } = useVisibilitySettings();
  const { findGrant } = useStudentAccess();
  const humanInterviewGrantUrl =
    findGrant("human_interview", "default")?.url?.trim() ||
    findGrant("human_interview", "main")?.url?.trim() ||
    null;
  const onlineL1ResultsVisible = settings.onlineL1Results;
  const phase = getPhase(journey.journeyState);
  const level = getLevel(journey.journeyState);
  const meta = LEVEL_META[level];
  const assessmentStatus = getAssessmentStepStatus(assessments, level);
  const resultsVisible = areAssignmentResultsVisible();
  const cycle2Track = level === 1 && isCycle2Candidate(assessments, userId);
  const assessmentLive = cycle2Track ? isL1July12AssessmentLive() : isAssessmentLive();
  const showPostExamHero =
    !cycle2Track &&
    (isExamWindowClosed() || resultsVisible) &&
    (phase === "PREP" || phase === "EXAM_OPEN");

  // Cleared Online L1 → FE / Human Interview pipeline (AI Mock removed).
  if (level === 1 && isCycle1Cleared(assessments, userId)) {
    let pipelineStage = getL1PipelineStage(journey, assessments, null, feProjectMinScore);
    const feCleared = hasClearedFeProject(assessments, feProjectMinScore);

    if (pipelineStage === "human_interview_active" && !settings.humanInterviewResults && !humanInterviewGrantUrl) {
      pipelineStage = settings.feProjectResults || feCleared ? "human_interview_active" : "fe_project_active";
    }

    if (
      feCleared &&
      !settings.humanInterviewResults &&
      !humanInterviewGrantUrl &&
      pipelineStage === "human_interview_active"
    ) {
      return (
        <div
          className="relative overflow-hidden rounded-2xl border border-[rgba(103,65,217,0.15)] p-5 shadow-soft sm:p-6 md:p-8"
          style={{ background: "linear-gradient(130deg, #ede9fe, #f8f7ff)" }}
        >
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(103,65,217,0.2)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
              <PulsingDot color="#6741d9" /> Next step pending
            </div>
            <LevelHeading name={meta.name} level={level} />
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Human Interview coming soon
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted2">
              You cleared the FE Project. Human Interview details will appear here once released by
              the team.
            </p>
          </div>
        </div>
      );
    }

    if (pipelineStage) {
      const showHumanCta =
        pipelineStage === "human_interview_active" && Boolean(humanInterviewGrantUrl);
      return (
        <L1PipelineStageHero
          level={level}
          stage={pipelineStage}
          ctaUrl={showHumanCta ? humanInterviewGrantUrl : null}
          ctaLabel="Open Human Interview"
        />
      );
    }

    return <ClearedAssessmentHero level={level} statusLabel="Qualified" />;
  }

  // Cycle 2 track: attempted Cycle 1 but did not clear — show past results + upcoming exam.
  if (
    level === 1 &&
    assessmentStatus === "attempted_not_cleared" &&
    !hasClearedAssessment(assessments, 1)
  ) {
    if (hasAttemptedL1Cycle2(assessments) && !onlineL1ResultsVisible) {
      return (
        <div
          className="relative overflow-hidden rounded-2xl border border-[rgba(103,65,217,0.15)] p-5 shadow-soft sm:p-6 md:p-8"
          style={{ background: "linear-gradient(130deg, #ede9fe, #f8f7ff)" }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(103,65,217,0.2)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
                <PulsingDot color="#6741d9" /> Assessment completed
              </div>
              <LevelHeading name={meta.name} level={level} />
              <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
                Results coming soon
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted2">
                You completed the L1 online assessment. Your results are being processed and will
                appear here once released.
              </p>
            </div>
            <div className="relative flex shrink-0 flex-col items-center gap-3 lg:items-end">
              <span className="genz-badge inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-brand">
                Processing
              </span>
            </div>
          </div>
        </div>
      );
    }

    const assessment = hasAttemptedL1Cycle2(assessments)
      ? pickL1AssessmentForResults(assessments, onlineL1ResultsVisible)
      : pickAssessmentForLevel(assessments, 1);
    const overallPct = assessment ? assessmentOverallPct(assessment) : 0;
    const statusLabel = assessment ? formatL1OnlineStatus(assessment) : "Not qualified";

    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(245,159,0,0.28)] p-6 shadow-soft sm:p-8"
        style={{ background: "linear-gradient(130deg, #fff9db, #fff5f5)" }}
      >
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <div className="text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(245,159,0,0.35)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#e67700]">
              <PulsingDot color="#f59f00" /> Not qualified
            </div>
            <LevelHeading name={meta.name} level={level} />
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Not qualified yet
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted2">
              You scored{" "}
              <span className="font-bold text-ink">{overallPct}%</span> — you need 70% to qualify.
              Register for the next assessment when it opens on your dashboard.
            </p>
            {assessment ? (
              <div className="mt-3">
                <Pill tone="amber">Not qualified · {overallPct}%</Pill>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2">
            <Pill tone="amber">{statusLabel}</Pill>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand/80">Keep preparing</p>
          </div>
        </div>
      </div>
    );
  }

  if (showPostExamHero) {
    const cleared = assessmentStatus === "done";
    const attempted = assessmentStatus === "attempted_not_cleared";
    const assessment = pickAssessmentForLevel(assessments, level);

    if (cleared) {
      return <ClearedAssessmentHero level={level} statusLabel="Qualified" />;
    }

    return (
      <div
        className={
          attempted
            ? "relative overflow-hidden rounded-2xl border border-[rgba(245,159,0,0.28)] p-6 shadow-soft sm:p-8"
            : "relative overflow-hidden rounded-2xl border border-[rgba(103,65,217,0.15)] p-6 shadow-soft sm:p-8"
        }
        style={{
          background: attempted
            ? "linear-gradient(130deg, #fff9db, #fff5f5)"
            : "linear-gradient(130deg, #ede9fe, #f8f7ff)",
        }}
      >
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <div className="text-center sm:text-left">
            <div
              className={
                attempted
                  ? "mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(245,159,0,0.35)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#e67700]"
                  : "mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(103,65,217,0.2)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand"
              }
            >
              {attempted ? (
                <><PulsingDot color="#f59f00" /> Not qualified</>
              ) : (
                <><PulsingDot color="#6741d9" /> Assessment window closed</>
              )}
            </div>
            <LevelHeading name={meta.name} level={level} />
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              {attempted
                ? "Not qualified yet"
                : "Assessment day is over"}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted2">
              {attempted ? (
                <>You scored below 70% on the L1 online assessment. Register for the next sit when it opens on your dashboard.</>
              ) : resultsVisible ? (
                <>Assessment completed. The next assessment window will be announced on your dashboard.</>
              ) : (
                <>The assessment window has ended. Results will appear here once released.</>
              )}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2">
            {attempted && assessment ? (
              <Pill tone="amber">{formatL1OnlineStatus(assessment)}</Pill>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

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
            <LevelHeading name={meta.name} level={level} />
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              {meta.tag}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted2">L3 Assessment</p>
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

  // ── POST_ASSESSMENT (non-cleared path — rare if journey state ahead of scores) ──
  if (phase === "POST_ASSESSMENT") {
    if (assessmentStatus === "done") {
      return <ClearedAssessmentHero level={level} statusLabel="Qualified" />;
    }

    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(12,166,120,0.25)] p-6 shadow-soft sm:p-8"
        style={{ background: "linear-gradient(130deg, #e8faf0, #f0fff8)" }}
      >
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <div className="text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(12,166,120,0.3)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal">
              <PulsingDot color="#0ca678" /> Assessment completed
            </div>
            <LevelHeading name={meta.name} level={level} />
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Post-Assessment is live
            </h2>
            <p className="mt-1 text-sm font-medium text-muted2">
              Complete your FE project, then continue with mock interviews.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-2">
            <Pill tone="green">Qualified</Pill>
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
            <LevelHeading name={meta.name} level={level} />
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Your next attempt is coming up
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted2">
              This round didn't go through — that happens. We'll notify you here when the next
              attempt window opens on your dashboard.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-[rgba(59,91,219,0.18)] bg-l1-bg px-6 py-5">
            <CalendarClock className="h-6 w-6 text-l1" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-l1">Status</p>
            <p className="font-display text-base font-extrabold text-ink">Re-attempt pending</p>
          </div>
        </div>
      </div>
    );
  }

  // ── EXAM_OPEN but assessment day hasn't arrived yet (approaching) ──
  // "Live" must only ever show on the assessment date itself — never before.
  if (phase === "EXAM_OPEN" && !assessmentLive) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(168,85,247,0.22)] p-6 shadow-soft-md animate-pop-in sm:p-8"
        style={{ background: "linear-gradient(125deg, #ddd6fe 0%, #fbcfe8 45%, #cffafe 100%)" }}
      >
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.28),transparent_70%)] blur-2xl animate-glow-pulse" />
        <div
          className="pointer-events-none absolute -bottom-28 left-1/4 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.22),transparent_70%)] blur-2xl animate-glow-pulse"
          style={{ animationDelay: "1.4s" }}
        />
        <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full items-center gap-4 sm:gap-5 lg:w-auto">
            <div className="select-none shrink-0 text-[3.25rem] leading-none drop-shadow-sm animate-float-soft">🗓️</div>
            <div className="min-w-0 text-left">
              <div className="genz-badge mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
                Assessment day approaching
              </div>
              <LevelHeading name={meta.name} level={level} />
              <h2 className="shimmer-text font-display text-[1.65rem] font-extrabold leading-tight sm:text-[1.85rem]">
                {meta.tag}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted2">
                Your assessment goes live soon. Keep prepping — MCQs &amp; coding. 🔥
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="genz-chip-violet rounded-lg px-2.5 py-1 text-[10px] font-bold">MCQs</span>
                <span className="genz-chip-cyan rounded-lg px-2.5 py-1 text-[10px] font-bold">Coding</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2">
            <span className="genz-badge inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-ink">
              Upcoming
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand/80">Goes live in</p>
            <CountdownRing value={days} unit="Days" tone="blue" size={96} showUnit />
          </div>
        </div>
      </div>
    );
  }

  // ── EXAM_OPEN (live) ──
  if (phase === "EXAM_OPEN") {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(236,72,153,0.28)] p-6 shadow-soft-md animate-pop-in sm:p-8"
        style={{ background: "linear-gradient(125deg, #fbcfe8 0%, #f5d0fe 40%, #cffafe 100%)" }}
      >
        <div className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.25),transparent_70%)] blur-2xl animate-glow-pulse" />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.2),transparent_70%)] blur-2xl animate-glow-pulse"
          style={{ animationDelay: "1.2s" }}
        />

        <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full items-center gap-4 sm:gap-5 lg:w-auto">
            <div className="relative shrink-0">
              <div className="select-none text-[3.25rem] leading-none drop-shadow-sm animate-float-soft">⚡</div>
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon opacity-60" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-2" />
              </span>
            </div>
            <div className="min-w-0 text-left">
              <div className="genz-badge mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-2">
                <PulsingDot color="#ec4899" /> Assessment is live
              </div>
              <LevelHeading name={meta.name} level={level} />
              <h2 className="shimmer-text font-display text-[1.65rem] font-extrabold leading-tight sm:text-[1.85rem]">
                {meta.tag}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted2">
                Window closes in{" "}
                <span className="font-bold text-brand-2">
                  {days} {days === 1 ? "day" : "days"}
                </span>
                . MCQs &amp; coding — go full send. 🔥
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="genz-chip-violet rounded-lg px-2.5 py-1 text-[10px] font-bold">MCQs</span>
                <span className="genz-chip-cyan rounded-lg px-2.5 py-1 text-[10px] font-bold">Coding</span>
                <span className="genz-chip-pink rounded-lg px-2.5 py-1 text-[10px] font-bold">✨ Live now</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2">
            <span className="genz-badge inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-ink">
              Live now
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-2/80">Closes in</p>
            <CountdownRing value={days} unit="Days" total={14} tone="neon" size={96} showUnit />
          </div>
        </div>
      </div>
    );
  }

  // ── REATTEMPT_ACTIVE (live round 2) ──
  if (phase === "REATTEMPT_ACTIVE") {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(251,191,36,0.35)] p-6 shadow-soft-md animate-pop-in sm:p-8"
        style={{ background: "linear-gradient(125deg, #fde68a 0%, #fbcfe8 45%, #ddd6fe 100%)" }}
      >
        <div className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.22),transparent_70%)] blur-2xl animate-glow-pulse" />

        <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full items-center gap-4 sm:gap-5 lg:w-auto">
            <div className="select-none shrink-0 text-[3.25rem] leading-none drop-shadow-sm animate-float-soft">🔁</div>
            <div className="min-w-0 text-left">
              <div className="genz-badge mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-l2-text">
                <PulsingDot color="#fbbf24" /> Round 2 is live
              </div>
              <LevelHeading name={meta.name} level={level} />
              <h2 className="shimmer-text font-display text-[1.65rem] font-extrabold leading-tight sm:text-[1.85rem]">
                {meta.tag}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted2">
                Your comeback window is open —{" "}
                <span className="font-bold text-brand-2">
                  {days} {days === 1 ? "day" : "days"}
                </span>{" "}
                left. Main character energy only. 💥
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2">
            <span className="genz-badge inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-ink">
              Re-attempt live
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand/80">Closes in</p>
            <CountdownRing value={days} unit="Days" tone="pink" size={96} showUnit />
          </div>
        </div>
      </div>
    );
  }

  // ── PREP (default — upcoming assessment) ──
  const nextLevel = level < 3 ? LEVEL_META[(level + 1) as 1 | 2 | 3] : null;
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[rgba(168,85,247,0.22)] p-6 shadow-soft-md animate-pop-in sm:p-8"
      style={{ background: "linear-gradient(125deg, #ede9fe 0%, #fce7f3 42%, #ecfeff 100%)" }}
    >
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.28),transparent_70%)] blur-2xl animate-glow-pulse" />
      <div
        className="pointer-events-none absolute -bottom-28 left-1/4 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.22),transparent_70%)] blur-2xl animate-glow-pulse"
        style={{ animationDelay: "1.4s" }}
      />
      <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full items-center gap-4 sm:gap-5 lg:w-auto">
          <div className="select-none shrink-0 text-[3.25rem] leading-none drop-shadow-sm animate-float-soft">🚀</div>
          <div className="min-w-0 text-left">
            <div className="genz-badge mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
              <PulsingDot color="#a855f7" /> Your next mission
            </div>
            <LevelHeading name={meta.name} level={level} />
            <h2 className="shimmer-text font-display text-[1.65rem] font-extrabold leading-tight sm:text-[1.85rem]">
              {meta.tag}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted2">
              {nextLevel ? (
                <>
                  Clear this assessment to unlock{" "}
                  <span className="font-bold text-brand-2">
                    {nextLevel.name}: {nextLevel.tag}
                  </span>
                  .
                </>
              ) : (
                <>Clear this to lock in your placement — the finish line is right there.</>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <span className="genz-badge inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-ink">
            Upcoming
          </span>
          <CountdownRing value={days} unit="Days" tone="blue" size={96} showUnit />
        </div>
      </div>
    </div>
  );
}
