import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Check,
  ChevronRight,
  ClipboardList,
  Code2,
  ExternalLink,
  FileText,
  Info,
  Lock,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import {
  CARD_SURFACE,
  IllustrationTile,
  RAIL_DOT,
  RAIL_SEGMENT,
  StatusPill,
  type Tone,
} from "@/components/irp/IrpClearCards";
import { GenAiCoursesDialog } from "@/components/irp/LevelCoursesDialog";
import {
  GenaiLoomSubmissionForm,
  type LoomSubmissionRecord,
} from "@/components/GenaiLoomSubmissionForm";
import { RegistrationBatchCallout } from "@/components/irp/RegistrationBatchCallout";
import { ScheduledAccessCallouts } from "@/components/irp/ScheduledAccessCallouts";
import { useProgramBoard } from "@/lib/useProgramBoard";
import type { GenAiAssessment } from "@/lib/programBoard";
import { accessStageLabel, isGenaiAccessStage } from "@/lib/accessStages";
import { isAccessGrantLive, useStudentAccess } from "@/lib/useStudentAccess";
import { useGenaiProjectSubmission } from "@/lib/useGenaiProjectSubmission";
import { useGenaiProjectChoices } from "@/lib/useGenaiProjectChoices";
import {
  useGenaiResults,
  type GenaiAssessmentResult,
  type GenaiAssessmentStatus,
  type GenaiInterviewResult,
} from "@/lib/useGenaiResults";

const JOIN_LEAD_MS = 15 * 60 * 1000;
const SHOW_GENAI_INTERVIEW_PANEL = false;

const GENAI_PROJECTS = [
  {
    title: "Intelligent RAG Challenge",
    description:
      "Apply Retrieval-Augmented Generation (RAG) concepts to build intelligent solutions that retrieve relevant information and generate accurate, context-aware responses.",
    url: "https://www.kaggle.com/t/41aae299568d4090b671dc42c9aa80a5",
  },
  {
    title: "Agentic RAG Challenge",
    description:
      "Explore agent-based RAG workflows to solve complex tasks using intelligent retrieval, reasoning, and automated decision-making.",
    url: "https://www.kaggle.com/t/b8bb6acbe1ee4bc2bf18312134213caa",
  },
  {
    title: "Building & Optimizing RAG Challenge",
    description:
      "Build and improve RAG pipelines by optimizing information retrieval, response relevance, and overall system performance.",
    url: "https://www.kaggle.com/t/3d4e632d65aa4cc888f463a555094618",
  },
] as const;

const GENAI_PROJECT_TITLES = GENAI_PROJECTS.map((project) => project.title);

type TrackTab = "assessments" | "project" | "loom";
type ProjectChoices = ReturnType<typeof useGenaiProjectChoices>;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function joinOpensLabel(hour: number, minute: number): string {
  const total = (hour * 60 + minute - 15 + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `Join class (opens ${h12}:${pad(m)} ${suffix})`;
}

/** Next class start in IST. Join opens 15 minutes before that. */
function nextClassStart(hour: number, minute: number, now = new Date()): Date {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  let start = new Date(`${day}T${pad(hour)}:${pad(minute)}:00+05:30`);
  if (start.getTime() <= now.getTime()) {
    start = new Date(start.getTime() + 86_400_000);
  }
  return start;
}

function shortRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${total % 60}s`;
}

function openClassLink(link: string, setLocation: (path: string) => void) {
  const target = link.trim() || "/";
  if (target.startsWith("/") && !target.startsWith("//")) {
    setLocation(target);
    return;
  }
  if (/^https?:\/\//i.test(target)) window.location.assign(target);
}

export function GenAiProgram() {
  const g = useProgramBoard().genai;
  const results = useGenaiResults();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [now, setNow] = useState(() => new Date());
  const tabParam = new URLSearchParams(search).get("tab");
  const trackTab: TrackTab = tabParam === "project" || tabParam === "loom" ? tabParam : "assessments";
  const projectChoices = useGenaiProjectChoices(GENAI_PROJECT_TITLES);

  function setTrackTab(tab: TrackTab) {
    const params = new URLSearchParams(search);
    if (tab === "assessments") params.delete("tab");
    else params.set("tab", tab);
    const query = params.toString();
    setLocation(`/genai-program${query ? `?${query}` : ""}`, { replace: true });
  }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = nextClassStart(g.classHour, g.classMinute, now);
  const remaining = start.getTime() - now.getTime();
  const joinOpen = remaining <= JOIN_LEAD_MS;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#101828] sm:text-[28px]">
          GenAI Track
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Live classes, assessments, project and interview for your GenAI track.
        </p>
      </div>

      <RegistrationBatchCallout track="genai" />
      <GenAiAccessLinks />
      <ScheduledAccessCallouts track="genai" />
      <GenAiJourney
        assessments={g.assessments}
        results={results.assessments}
        selectedProjectCount={projectChoices.selectedProjects.length}
        onTab={setTrackTab}
      />
      <GenAiAssessments
        assessments={g.assessments}
        results={results.assessments}
        resultsError={results.error}
        onRetryResults={results.retry}
        tab={trackTab}
        onTab={setTrackTab}
        projectChoices={projectChoices}
      />
      {results.interviews.length > 0 ? <GenAiAiInterview interviews={results.interviews} /> : null}
      {SHOW_GENAI_INTERVIEW_PANEL ? <GenAiInterview /> : null}

      {g.classTitle ? (
      <section className="rounded-2xl border border-[#eaecf0] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {g.liveBadge ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#067647]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#12b76a]" />
              {g.liveBadge}
            </span>
          ) : <span />}
          {g.weekOf ? (
            <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-semibold text-[#344054]">
              {g.weekOf}
            </span>
          ) : null}
        </div>
        {g.weekLabel ? <p className="mt-5 text-xs font-semibold tracking-wide text-[#667085]">{g.weekLabel}</p> : null}
        <h2 className="mt-1 font-display text-xl font-extrabold text-[#101828] sm:text-2xl">{g.classTitle}</h2>
        <Countdown remaining={remaining} />
        <p className="mt-3 text-sm text-[#667085]">Join opens 15 minutes before the start.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {joinOpen ? (
            <a
              href={g.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-[#6941c6] px-3.5 py-2 text-sm font-bold text-white hover:bg-[#5925dc]"
            >
              Join class
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center rounded-lg bg-[#f2f4f7] px-3.5 py-2 text-sm font-semibold text-[#98a2b3]"
            >
              {joinOpensLabel(g.classHour, g.classMinute)}
            </button>
          )}
        </div>
      </section>
      ) : null}

      <section className="rounded-2xl border border-[#eaecf0] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-[#101828]">Live classes</h2>
            <p className="mt-0.5 text-sm text-[#667085]">Select a class to open it.</p>
          </div>
          <a
            href={g.portalUrl || "https://learning.ccbp.in/course-live-classes"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#6941c6] px-3.5 py-2 text-sm font-bold text-white hover:bg-[#5925dc]"
          >
            {g.portalLabel || "Open GenAI on Learning Portal"}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {g.classes.length === 0 ? (
          <p className="mt-4 border-t border-[#f2f4f7] pt-4 text-sm text-[#667085]">No live classes yet.</p>
        ) : (
        <ul className="mt-4 divide-y divide-[#f2f4f7] border-t border-[#f2f4f7]">
          {g.classes.map((item) => (
            <li key={item.day + item.date + item.time}>
              <button
                type="button"
                onClick={() => openClassLink(item.link ?? "/", setLocation)}
                className="flex w-full items-center gap-3 py-3.5 text-left hover:bg-[#fcfcfd]"
              >
                <span className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-[#f4f3ff] px-1 py-1.5 text-[#6941c6]">
                  <span className="text-[9px] font-bold tracking-wide">{item.day}</span>
                  <span className="font-display text-sm font-extrabold leading-none">{item.date}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#101828]">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    {item.time} · {item.duration} · {item.instructor}
                  </p>
                </div>
                <p className="hidden shrink-0 text-xs font-medium text-[#667085] sm:block">
                  {item.live ? `Starts in ${shortRemaining(remaining)}` : item.action}
                </p>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#98a2b3]" />
              </button>
            </li>
          ))}
        </ul>
        )}
      </section>
    </div>
  );
}

function Countdown({ remaining }: { remaining: number }) {
  const total = Math.max(0, Math.floor(remaining / 1000));
  const parts = [
    ["Hours", Math.floor(total / 3600)],
    ["Min", Math.floor((total % 3600) / 60)],
    ["Sec", total % 60],
  ] as const;
  return (
    <div className="mt-4 flex items-center gap-2">
      {parts.map(([label, value], index) => (
        <div key={label} className="flex items-center gap-2">
          <div className="min-w-[4.25rem] rounded-xl bg-[#f9fafb] px-2 py-2 text-center">
            <p className="font-display text-xl font-extrabold tabular-nums text-[#101828]">{pad(value)}</p>
            <p className="text-[10px] font-semibold tracking-wide text-[#98a2b3]">{label}</p>
          </div>
          {index < parts.length - 1 ? <span className="font-semibold text-[#d0d5dd]">:</span> : null}
        </div>
      ))}
    </div>
  );
}

function cleanTitle(title: string): string {
  return title.replace(/^\[|\]$/g, "");
}

const WRITTEN_STATUSES: GenaiAssessmentStatus[] = ["QUALIFIED", "NOT_QUALIFIED", "RESULT_PENDING"];

type GenAiStage = {
  key: string;
  label: string;
  Icon: typeof FileText;
  tone: Tone;
  badge: string | null;
  body: string;
  action: { label: string; onClick: () => void } | null;
  onHowToClear?: () => void;
};

function scrollToAssessments() {
  document.getElementById("genai-assessments")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function GenAiJourney({
  assessments,
  results,
  selectedProjectCount,
  onTab,
}: {
  assessments: GenAiAssessment[];
  results: GenaiAssessmentResult[];
  selectedProjectCount: number;
  onTab: (tab: TrackTab) => void;
}) {
  const { query: submissionQuery } = useGenaiProjectSubmission(true);
  const submitted = Boolean(submissionQuery.data?.submission);
  const written = results.filter((item) => WRITTEN_STATUSES.includes(item.status)).length;
  const qualified = results.some((item) => item.status === "QUALIFIED");
  const pending = results.some((item) => item.status === "RESULT_PENDING");
  const upcoming = results.some((item) => item.status === "UPCOMING");
  const registrationOpen = assessments.some((item) => item.status === "open");
  const projectLocked = assessments.length === 0 || assessments.some((item) => item.status !== "completed");

  const assessmentTone: Tone = qualified
    ? "done"
    : written > 0 && !pending && !upcoming && !registrationOpen
      ? "failed"
      : "active";
  const projectUnlocked = qualified || !projectLocked;
  const projectsChosen = selectedProjectCount >= 2;
  const projectTone: Tone = !projectUnlocked ? "locked" : projectsChosen || submitted ? "done" : "active";
  const loomTone: Tone = submitted ? "done" : projectUnlocked ? "active" : "locked";

  const [coursesOpen, setCoursesOpen] = useState(false);

  function openTab(tab: TrackTab) {
    onTab(tab);
    requestAnimationFrame(scrollToAssessments);
  }

  const stages: GenAiStage[] = [
    {
      key: "assessments",
      onHowToClear: () => setCoursesOpen(true),
      label: "Assessments",
      Icon: ClipboardList,
      tone: assessmentTone,
      badge: qualified ? "Qualified" : null,
      body:
        assessmentTone === "done"
          ? "You qualified in a GenAI assessment."
          : assessmentTone === "failed"
            ? "Your GenAI assessment scores are below the qualifying marks so far."
            : registrationOpen
              ? "Registration is open. Register for your next GenAI assessment."
              : pending
                ? "Your GenAI assessment result is being processed."
                : upcoming
                  ? "Your next GenAI assessment is coming up."
                  : "Qualify in a GenAI assessment to move to the project.",
      action: { label: written > 0 ? "View scores" : "View assessments", onClick: () => openTab("assessments") },
    },
    {
      key: "project",
      label: "Project Submission",
      Icon: Code2,
      tone: projectTone,
      badge: projectTone === "done" ? "2 projects chosen" : null,
      body:
        projectTone === "done"
          ? "You chose your 2 projects."
          : projectTone === "active"
            ? `${Math.min(selectedProjectCount, 2)} of 2 projects chosen. Choose any 2 projects.`
            : "Qualify in a GenAI assessment to unlock the project.",
      action: projectTone === "locked"
        ? null
        : { label: projectTone === "done" ? "View projects" : "Choose projects", onClick: () => openTab("project") },
    },
    {
      key: "loom",
      label: "Loom Video Submission",
      Icon: Video,
      tone: loomTone,
      badge: submitted ? "Submitted" : null,
      body:
        loomTone === "done"
          ? "Your Loom walkthrough video is submitted."
          : loomTone === "active"
            ? projectsChosen
              ? "Submit 1 Loom video for one of your 2 projects."
              : "Choose your 2 projects first, then submit 1 Loom video for one of them."
            : "Unlocks with Project Submission.",
      action: loomTone === "locked"
        ? null
        : { label: submitted ? "View submission" : "Submit Loom video", onClick: () => openTab("loom") },
    },
    {
      key: "interview",
      label: "Human Interview",
      Icon: Users,
      tone: "locked",
      badge: null,
      body: submitted
        ? "Your Human Interview opens after your project is evaluated."
        : "Submit your Loom video to unlock the Human Interview.",
      action: null,
    },
  ];

  const header = !qualified
    ? "Qualify in a GenAI assessment to start your GenAI Track stages."
    : submitted
      ? "Your Loom video is submitted. Your Human Interview opens after your project is evaluated."
      : projectsChosen
        ? "You chose your 2 projects. Submit your Loom video to continue."
        : "You qualified in a GenAI assessment. Choose your 2 projects to continue.";

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d1e9ff] bg-white shadow-[0_8px_30px_rgba(16,24,40,0.04)]">
      <GenAiCoursesDialog open={coursesOpen} onOpenChange={setCoursesOpen} />
      <div className="bg-[linear-gradient(90deg,#eff8ff_0%,#f5faff_42%,#ffffff_100%)] px-4 py-5 sm:px-6">
        <span className="inline-flex items-center rounded-full border border-[#84caff] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#175cd3]">
          GenAI Track
        </span>
        <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight text-[#111827] sm:text-2xl">
          Complete all stages of the GenAI Track
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[#667085]">{header}</p>
      </div>

      <div className="px-3 py-4 sm:px-5 sm:py-5">
        <ol aria-hidden className="relative mb-4 hidden grid-cols-4 gap-4 xl:grid">
          {stages.map((stage, index) => {
            const next = stages[index + 1];
            return (
              <li key={stage.key} className="relative flex justify-center">
                {next ? (
                  <span
                    className={`absolute left-[calc(50%+22px)] top-1/2 w-[calc(100%-44px+1rem)] -translate-y-1/2 ${RAIL_SEGMENT[next.tone]}`}
                  />
                ) : null}
                <span
                  className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold ${RAIL_DOT[stage.tone]}`}
                >
                  {index + 1}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stages.map((stage, index) => (
            <article
              key={stage.key}
              data-testid={`card-genai-stage-${stage.key}`}
              className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-4 shadow-[0_4px_16px_rgba(16,24,40,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(16,24,40,0.10)] sm:p-5 ${CARD_SURFACE[stage.tone]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <IllustrationTile icon={stage.Icon} tone={stage.tone} chat={stage.key === "interview"} />
                <div className="flex flex-col items-end gap-1.5">
                  <StatusPill tone={stage.tone} />
                  {stage.onHowToClear ? (
                    <button
                      type="button"
                      onClick={stage.onHowToClear}
                      data-testid={`button-how-to-clear-${stage.key}`}
                      className="inline-flex items-center gap-1 rounded-full border border-[#d6bbfb] bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-[#6941c6] transition-colors hover:border-[#b692f6] hover:bg-[#f4f3ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6]"
                    >
                      <Info className="h-3 w-3" />
                      How to clear?
                    </button>
                  ) : null}
                </div>
              </div>

              <h3 className="mt-4 flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#111827]">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold xl:hidden ${RAIL_DOT[stage.tone]}`}
                >
                  {index + 1}
                </span>
                {stage.label}
              </h3>
              {stage.tone === "done" && stage.badge ? (
                <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
                  <Check className="h-3 w-3" />
                  {stage.badge}
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-relaxed text-[#667085]">{stage.body}</p>

              <div className="mt-auto pt-4">
                {stage.action ? (
                  <span className="block rounded-xl bg-[linear-gradient(135deg,#c4b5fd_0%,#93c5fd_100%)] p-px shadow-[0_6px_16px_rgba(105,65,198,0.22)]">
                    <button
                      type="button"
                      onClick={stage.action.onClick}
                      className="flex w-full items-center justify-center gap-1.5 rounded-[11px] bg-[linear-gradient(135deg,#6941c6_0%,#7f56d9_100%)] px-3 py-2.5 text-sm font-extrabold text-white transition-opacity hover:opacity-90"
                    >
                      {stage.action.label}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#e4e7ec] bg-[#f2f4f7]/80 px-3 py-2.5 text-sm font-bold text-[#98a2b3]"
                  >
                    <Lock className="h-4 w-4" />
                    Locked
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mx-3 mb-3 flex flex-col gap-4 rounded-2xl border border-[#d1e9ff] bg-[linear-gradient(90deg,#f5faff_0%,#f8f7ff_55%,#f5f8ff_100%)] px-4 py-4 sm:mx-5 sm:mb-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 lg:w-[19rem] lg:shrink-0">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#d1e9ff_0%,#6941c6_100%)] text-white shadow-[0_6px_14px_rgba(105,65,198,0.3)]">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <p className="text-base font-extrabold text-[#111827]">
              Your GenAI progress ({stages.filter((stage) => stage.tone === "done").length}/{stages.length} done)
            </p>
            <p className="text-xs text-[#667085]">Clear each stage to reach your GenAI Human Interview.</p>
          </div>
        </div>
        <span aria-hidden className="hidden h-12 w-px bg-[#dbe4f5] lg:block" />
        <div className="flex flex-wrap gap-2">
          {stages.map((stage, index) => (
            <span
              key={stage.key}
              className="inline-flex items-center gap-2 rounded-full border border-[#eef0f4] bg-white py-1 pl-1 pr-1.5 text-xs font-bold text-[#344054] shadow-[0_1px_3px_rgba(16,24,40,0.06)]"
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${RAIL_DOT[stage.tone]}`}>
                {index + 1}
              </span>
              {stage.label}
              <StatusPill tone={stage.tone} />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function GenAiAssessments({
  assessments,
  results,
  resultsError,
  onRetryResults,
  tab,
  onTab,
  projectChoices,
}: {
  assessments: GenAiAssessment[];
  results: GenaiAssessmentResult[];
  resultsError: string | null;
  onRetryResults: () => void;
  tab: TrackTab;
  onTab: (tab: TrackTab) => void;
  projectChoices: ProjectChoices;
}) {
  const openItems = assessments.filter((item) => item.status === "open");
  const completed = assessments.filter((item) => item.status === "completed");
  const openCount = openItems.length;
  const upcoming = results.filter((item) => item.status === "UPCOMING");
  const scored = results.filter((item) => item.status !== "UPCOMING");
  const { selectedProjects, setSelectedProjects, choicesReady, choicesError } = projectChoices;
  const [loomProject, setLoomProject] = useState<string | null>(null);
  const { query: loomQuery, save: saveLoom } = useGenaiProjectSubmission(true);
  const loomSubmission = loomQuery.data?.submission ?? null;
  const selectedLoomProject =
    selectedProjects.length > 0
      ? (loomProject && selectedProjects.includes(loomProject) ? loomProject : selectedProjects[0])
      : null;
  const submissionProject = selectedLoomProject;

  function toggleProject(title: string) {
    if (!choicesReady) return;
    saveLoom.reset();
    if (selectedProjects.includes(title)) {
      const next = selectedProjects.filter((project) => project !== title);
      setSelectedProjects(next);
      if (loomProject === title) setLoomProject(next[0] ?? null);
      return;
    }
    if (selectedProjects.length >= 2) return;
    setSelectedProjects([...selectedProjects, title]);
    if (!loomProject) setLoomProject(title);
  }

  return (
    <section id="genai-assessments" className="scroll-mt-4 rounded-2xl border border-[#eaecf0] bg-white p-5 sm:p-6">
      <h2 className="font-display text-lg font-extrabold text-[#101828]">GenAI Assessments</h2>
      <p className="mt-1 text-sm text-[#667085]">
        Register for your GenAI assessments and see your section-wise scores. Fixed dates for your batch.
      </p>
      <div className="mt-4 inline-flex flex-wrap rounded-lg bg-[#f2f4f7] p-1">
        <button
          type="button"
          data-testid="tab-genai-assessments"
          onClick={() => onTab("assessments")}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold ${
            tab === "assessments" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085]"
          }`}
        >
          Assessments
          {openCount > 0 ? (
            <span className="rounded-full bg-[#f79009] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {openCount} to register
            </span>
          ) : null}
        </button>
        <button
          type="button"
          data-testid="tab-genai-project"
          onClick={() => onTab("project")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            tab === "project" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085]"
          }`}
        >
          Project Submission
        </button>
        <button
          type="button"
          data-testid="tab-genai-loom"
          onClick={() => onTab("loom")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            tab === "loom" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085]"
          }`}
        >
          Loom Video Submission
        </button>
      </div>

      {tab === "assessments" ? (
        <div className="mt-4 space-y-4">
          {openItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-[#f9dbaf] bg-[#fffaeb] px-4 py-3">
              <p className="text-[11px] font-bold tracking-wide text-[#b54708]">REGISTRATION OPEN</p>
              <p className="mt-1 text-sm font-bold text-[#b54708]">{cleanTitle(item.title)}</p>
              <p className="mt-1 text-sm text-[#344054]">
                {item.when}
                {item.note ? <span className="font-semibold text-[#b54708]"> · {item.note}</span> : null}
              </p>
            </div>
          ))}
          {upcoming.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-[#101828]">Upcoming</h3>
              <ul className="mt-2 divide-y divide-[#f2f4f7] border-t border-[#f2f4f7]">
                {upcoming.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#101828]">{genaiAssessmentTitle(item)}</p>
                      <p className="mt-0.5 text-sm text-[#667085]">{formatIstDateTime(item.startsAt)}</p>
                    </div>
                    <GenaiStatusChip status={item.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <h3 className="text-sm font-semibold text-[#101828]">Your scores</h3>
            {resultsError ? (
              <div
                className="mt-3 rounded-xl border border-[#fecdca] bg-[#fef3f2] px-4 py-3 text-sm text-[#b42318]"
                role="alert"
                data-testid="error-genai-results"
              >
                <p>{resultsError}</p>
                <button
                  type="button"
                  className="mt-2 font-bold underline"
                  onClick={onRetryResults}
                  data-testid="button-retry-genai-results"
                >
                  Try again
                </button>
              </div>
            ) : null}
            {scored.length > 0 ? (
              <ul className="mt-2 divide-y divide-[#f2f4f7] border-t border-[#f2f4f7]">
                {scored.map((item) => (
                  <GenaiScoreRow key={item.id} item={item} />
                ))}
              </ul>
            ) : completed.length === 0 ? (
              <p className="mt-3 text-sm text-[#667085]">Scores appear here after you complete an assessment.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[#f2f4f7] border-t border-[#f2f4f7]">
                {completed.map((item) => (
                  <li key={item.id} className="py-3">
                    <p className="text-sm font-semibold text-[#101828]">{cleanTitle(item.title)}</p>
                    <p className="mt-0.5 text-sm text-[#667085]">
                      {item.when}
                      {item.score ? ` · Score ${item.score}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : tab === "project" ? (
        <div className="mt-6 space-y-6" data-testid="section-genai-projects">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eaecf0] pt-5">
                <h3 className="font-display text-base font-extrabold text-[#101828]">Choose your projects</h3>
                <p aria-live="polite" className="text-sm font-medium text-[#667085]" data-testid="text-project-selection-count">
                  {!choicesReady
                    ? "Loading saved choices…"
                    : selectedProjects.length === 0
                    ? "Choose any 2"
                    : selectedProjects.length === 1
                      ? "1 more project to choose"
                      : "2 of 2 projects selected"}
                </p>
              </div>
              {choicesError ? <p role="alert" className="text-sm text-[#b42318]">{choicesError}</p> : null}
              <p className="text-xs text-[#667085]">Your choices are saved in this browser for your account.</p>
              <div className="grid gap-3 md:grid-cols-3">
                {GENAI_PROJECTS.map((project, index) => (
                  <article
                    key={project.title}
                    data-testid={`card-genai-project-${index + 1}`}
                    className={`flex h-full flex-col rounded-2xl border p-5 transition-colors ${
                      selectedProjects.includes(project.title)
                        ? "border-[#7c3aed] bg-white ring-1 ring-[#7c3aed]"
                        : "border-[#eaecf0] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold tracking-wide text-[#667085]">
                        PROJECT {String(index + 1).padStart(2, "0")}
                      </span>
                      {selectedProjects.includes(project.title) ? (
                        <span
                          data-testid={`status-genai-project-${index + 1}`}
                          className="inline-flex items-center gap-1 rounded-full bg-[#f4f3ff] px-2 py-0.5 text-[10px] font-bold text-[#6941c6]"
                        >
                          {loomProject === project.title ? <><Video className="h-3 w-3" /> Selected · Video</> : "Selected"}
                        </span>
                      ) : null}
                    </div>
                    <h4 className="mt-3 font-display text-base font-extrabold leading-snug text-[#101828]">
                      {project.title}
                    </h4>
                    <p className="mt-2 flex-1 text-sm leading-6 text-[#475467]">{project.description}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <button
                      type="button"
                      data-testid={`button-toggle-genai-project-${index + 1}`}
                      aria-label={`${selectedProjects.includes(project.title) ? "Remove" : "Choose"} ${project.title}`}
                      aria-pressed={selectedProjects.includes(project.title)}
                      disabled={!choicesReady || (!selectedProjects.includes(project.title) && selectedProjects.length >= 2)}
                      onClick={() => {
                        const alreadySelected = selectedProjects.includes(project.title);
                        toggleProject(project.title);
                        if (!alreadySelected) {
                          window.open(project.url, "_blank", "noopener,noreferrer");
                        }
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedProjects.includes(project.title)
                          ? "border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f9fafb]"
                          : "border-[#6d28d9] bg-[#6d28d9] text-white hover:bg-[#5b21b6]"
                      }`}
                    >
                      {selectedProjects.includes(project.title) ? "Remove" : "Choose this project"}
                    </button>
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-kaggle-genai-project-${index + 1}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[#6941c6] hover:text-[#5925dc] hover:underline"
                    >
                      Open on Kaggle
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    </div>
                    {selectedProjects.includes(project.title) && loomProject !== project.title ? (
                      <button
                        type="button"
                        data-testid={`button-set-genai-loom-${index + 1}`}
                        onClick={() => {
                          setLoomProject(project.title);
                          saveLoom.reset();
                        }}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#6941c6] hover:bg-[#f9f5ff]"
                      >
                        <Video className="h-3.5 w-3.5" />
                        Use for Loom walkthrough
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
              <p className="text-xs leading-5 text-[#667085]">
                Complete any 2 projects, then submit a Loom video walkthrough for one of them in the Loom Video
                Submission tab.
              </p>
        </div>
      ) : null}
      {tab === "loom" ? (
      <div className="mt-4" data-testid="section-genai-loom">
        <GenaiLoomSubmissionForm
          projectTitle={submissionProject}
          allProjects={GENAI_PROJECT_TITLES}
          availableProjects={selectedProjects}
          onProjectChange={(title) => {
            if (!choicesReady || !(GENAI_PROJECT_TITLES as readonly string[]).includes(title)) return;
            if (!selectedProjects.includes(title)) {
              if (selectedProjects.length >= 2) return;
              setSelectedProjects([...selectedProjects, title]);
            }
            setLoomProject(title);
            saveLoom.reset();
          }}
          submission={loomSubmission}
          loading={loomQuery.isLoading}
          loadError={loomQuery.error instanceof Error ? loomQuery.error.message : null}
          onRetry={() => void loomQuery.refetch()}
          saving={saveLoom.isPending}
          saveError={saveLoom.error instanceof Error ? saveLoom.error.message : null}
          savedSubmission={saveLoom.data?.submission ?? null}
          onSave={(input) => saveLoom.mutate({ ...input, selectedProjects })}
          onResetSaveState={() => saveLoom.reset()}
        />
      </div>
      ) : null}
    </section>
  );
}

function formatIstDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatIstDateTime(iso: string | null): string {
  if (!iso) return "Date to be announced";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date to be announced";
  return `${new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d)} IST`;
}

function genaiAssessmentTitle(item: GenaiAssessmentResult): string {
  return item.number ? `GenAI Assessment ${item.number}` : item.title;
}

function formatScore(score: number | null, max: number | null): string {
  if (score == null) return "-";
  const value = Number.isInteger(score) ? String(score) : score.toFixed(1);
  return max != null && max > 0 ? `${value}/${max}` : value;
}

const STATUS_CHIP: Record<GenaiAssessmentStatus, { label: string; className: string }> = {
  QUALIFIED: { label: "Qualified", className: "border-[#abefc6] bg-[#ecfdf3] text-[#067647]" },
  NOT_QUALIFIED: { label: "Not qualified", className: "border-[#fedf89] bg-[#fffaeb] text-[#b54708]" },
  RESULT_PENDING: { label: "Result pending", className: "border-[#d0d5dd] bg-[#f9fafb] text-[#475467]" },
  NOT_ATTEMPTED: { label: "Not attempted", className: "border-[#eaecf0] bg-[#f9fafb] text-[#667085]" },
  UPCOMING: { label: "Upcoming", className: "border-[#b2ddff] bg-[#eff8ff] text-[#175cd3]" },
};

function GenaiStatusChip({ status }: { status: GenaiAssessmentStatus }) {
  const chip = STATUS_CHIP[status];
  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${chip.className}`}>
      {chip.label}
    </span>
  );
}

function GenaiScoreRow({ item }: { item: GenaiAssessmentResult }) {
  const showScores = item.status === "QUALIFIED" || item.status === "NOT_QUALIFIED";
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#101828]">{genaiAssessmentTitle(item)}</p>
          <p className="mt-0.5 text-sm text-[#667085]">{formatIstDate(item.attemptedAt ?? item.startsAt)}</p>
        </div>
        <GenaiStatusChip status={item.status} />
      </div>
      {showScores ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["MCQ", formatScore(item.mcqScore, item.mcqMax)],
            ["Coding", formatScore(item.codingScore, item.codingMax)],
            ["Total", formatScore(item.totalScore, item.totalMax)],
          ].map(([label, value]) => (
            <span key={label} className="rounded-lg bg-[#f9fafb] px-2.5 py-1 text-xs text-[#475467]">
              {label} <span className="font-bold text-[#101828]">{value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/** Live GenAI exam / interview links from admin access grants. */
function GenAiAccessLinks() {
  const { grants } = useStudentAccess();
  const live = grants.filter(
    (g) =>
      isGenaiAccessStage(g.stage) &&
      g.stage !== "genai_project" &&
      isAccessGrantLive(g) &&
      Boolean(g.url?.trim()),
  );
  if (live.length === 0) return null;
  return (
    <div className="grid gap-3">
      {live.map((grant) => {
        const kind = grant.linkKind === "default" ? "" : grant.linkKind === "mock" ? "Mock" : "Main";
        const cta =
          grant.stage === "genai_ai_interview"
            ? grant.linkKind === "mock" ? "Start Mock Interview" : "Start Interview"
            : grant.linkKind === "mock" ? "Start Mock" : "Start Assessment";
        return (
          <section
            key={grant.batchId}
            className="flex flex-col gap-3 rounded-2xl border border-[#d1e9ff] bg-[#f5faff] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-wide text-[#175cd3]">
                {kind ? `${kind.toUpperCase()} · ` : ""}OPEN NOW
              </p>
              <p className="mt-1 font-display text-base font-extrabold text-[#101828]">
                {accessStageLabel(grant.stage)}
              </p>
              {grant.name ? <p className="mt-0.5 text-sm text-[#667085]">{grant.name}</p> : null}
              {grant.expiresAt ? (
                <p className="mt-0.5 text-xs text-[#667085]">Closes {formatIstDateTime(grant.expiresAt)}</p>
              ) : null}
            </div>
            <a
              href={grant.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#175cd3] px-4 py-2 text-sm font-bold text-white hover:bg-[#1849a9]"
            >
              {cta}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </section>
        );
      })}
    </div>
  );
}

function formatRating(value: number | null): string {
  if (value == null) return "-";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}/10`;
}

function GenAiAiInterview({ interviews }: { interviews: GenaiInterviewResult[] }) {
  return (
    <section className="rounded-2xl border border-[#eaecf0] bg-white p-5 sm:p-6">
      <h2 className="font-display text-lg font-extrabold text-[#101828]">AI Interview</h2>
      <p className="mt-1 text-sm text-[#667085]">Your GenAI NxtMock interview ratings.</p>
      <ul className="mt-4 divide-y divide-[#f2f4f7] border-t border-[#f2f4f7]">
        {interviews.map((item) => (
          <li key={item.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#101828]">
                  {interviews.length > 1 && item.number
                    ? `GenAI NxtMock Interview ${item.number}`
                    : "GenAI NxtMock Interview"}
                </p>
                <p className="mt-0.5 text-sm text-[#667085]">
                  {item.status === "COMPLETED" ? formatIstDate(item.attemptedAt) : "Not attempted yet"}
                </p>
              </div>
              {item.status === "COMPLETED" ? (
                <span className="inline-flex shrink-0 rounded-full border border-[#d0d5dd] bg-[#f9fafb] px-2 py-0.5 text-[11px] font-bold text-[#344054]">
                  Average {formatRating(item.averageRating)}
                </span>
              ) : (
                <GenaiStatusChip status="NOT_ATTEMPTED" />
              )}
            </div>
            {item.status === "COMPLETED" && item.sections.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.sections.map((section) => (
                  <span key={section.key} className="rounded-lg bg-[#f9fafb] px-2.5 py-1 text-xs text-[#475467]">
                    {section.label} <span className="font-bold text-[#101828]">{formatRating(section.rating)}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

const INTERVIEW_SCORES = [
  { title: "Project Discussion and Live Modification", weight: "40% of score", score: "- / 5" },
  { title: "GenAI Concepts", weight: "30% of score", score: "- / 5" },
  { title: "Basic DSA", weight: "20% of score", score: "- / 5" },
  { title: "Communication", weight: "10% of score", score: "- / 5" },
  { title: "Overall", weight: "Out of 100", score: "- / 100", overall: true },
] as const;

function GenAiInterview() {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#eaecf0] border-t-[3px] border-t-[#175cd3] bg-white p-5 sm:p-6">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eff8ff] px-2.5 py-1 text-[11px] font-bold text-[#175cd3]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#175cd3]" />
        GenAI Track
      </span>
      <h2 className="mt-3 font-display text-xl font-extrabold text-[#101828]">Human Interview</h2>
      <p className="mt-1 text-sm text-[#667085]">One-on-one interview with a panel member · 45 min · Google Meet</p>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-[#344054]">
          Complete the GenAI assessments and get your GenAI project evaluated to unlock your Human Interview.
        </p>
        <div className="rounded-xl bg-[#f9fafb] px-4 py-3">
          <p className="text-sm font-semibold text-[#101828]">GenAI project</p>
          <p className="mt-0.5 text-xs text-[#667085]">Submission opens after the last assessment</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {INTERVIEW_SCORES.map((item) => (
          <div
            key={item.title}
            className={`rounded-xl border px-3 py-3 ${"overall" in item ? "border-[#d1e9ff] bg-[#eff8ff]" : "border-[#eaecf0] bg-white"}`}
          >
            <p className="text-xs font-semibold leading-snug text-[#101828]">{item.title}</p>
            <p className="mt-2 text-[11px] text-[#667085]">{item.weight}</p>
            <p className="mt-1 text-sm font-semibold text-[#344054]">{item.score}</p>
          </div>
        ))}
      </div>
      <details className="mt-4 rounded-xl border border-[#eaecf0] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#101828]">
          Scoring guidelines
          <span className="ml-2 font-medium text-[#667085]">What the panel looks for in each section</span>
        </summary>
        <ul className="mt-3 space-y-2 text-sm text-[#475467]">
          <li>Project Discussion and Live Modification: explain your project and change it live when asked.</li>
          <li>GenAI Concepts: prompts, retrieval, and how agents use tools.</li>
          <li>Basic DSA: solve a short problem and talk through the approach.</li>
          <li>Communication: clear answers, structure, and how you handle follow-up questions.</li>
        </ul>
      </details>
    </section>
  );
}
