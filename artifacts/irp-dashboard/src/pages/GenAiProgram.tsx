import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight, ExternalLink } from "lucide-react";
import { RegistrationBatchCallout } from "@/components/irp/RegistrationBatchCallout";
import { useProgramBoard } from "@/lib/useProgramBoard";
import type { GenAiAssessment } from "@/lib/programBoard";

const JOIN_LEAD_MS = 15 * 60 * 1000;
const SHOW_GENAI_INTERVIEW_PANEL = false;

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
  const [, setLocation] = useLocation();
  const [now, setNow] = useState(() => new Date());
  const [trackTab, setTrackTab] = useState<"assessments" | "project">("assessments");

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

      <RegistrationBatchCallout />
      <GenAiJourney assessments={g.assessments} />
      <GenAiAssessments
        assessments={g.assessments}
        tab={trackTab}
        onTab={setTrackTab}
      />
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

function GenAiJourney({ assessments }: { assessments: GenAiAssessment[] }) {
  const completed = assessments.filter((item) => item.status === "completed").length;
  const registrationOpen = assessments.some((item) => item.status === "open");
  const projectLocked = assessments.length === 0 || assessments.some((item) => item.status !== "completed");
  return (
    <section className="rounded-2xl border border-[#eaecf0] bg-white p-5 sm:p-6">
      <p className="text-[11px] font-bold tracking-wide text-[#98a2b3]">YOUR GENAI JOURNEY</p>
      <div className="relative mt-5 grid grid-cols-3 gap-3">
        <span className="absolute left-5 top-5 h-px w-2/3 bg-[#eaecf0]" />
        <div className="relative">
          <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#175cd3] font-display text-sm font-extrabold text-white ring-4 ring-white">
            1
          </span>
          <p className="mt-3 text-sm font-semibold text-[#101828]">Assessments</p>
          <span className="mt-2 inline-flex rounded-full border border-[#b2ddff] bg-[#eff8ff] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#175cd3]">
            {registrationOpen ? "REGISTRATION OPEN" : completed > 0 ? "IN PROGRESS" : "UPCOMING"}
          </span>
          <p className="mt-1 text-xs text-[#667085]">
            {completed} completed
          </p>
        </div>
        <div className="relative">
          <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f4f7] font-display text-sm font-extrabold text-[#98a2b3] ring-4 ring-white">
            2
          </span>
          <p className="mt-3 text-sm font-semibold text-[#98a2b3]">Project Submission</p>
          <span className="mt-2 inline-flex rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#667085]">
            {projectLocked ? "LOCKED" : "OPEN"}
          </span>
        </div>
        <div className="relative">
          <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f4f7] font-display text-sm font-extrabold text-[#98a2b3] ring-4 ring-white">
            3
          </span>
          <p className="mt-3 text-sm font-semibold text-[#98a2b3]">Human Interview</p>
          <span className="mt-2 inline-flex rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#667085]">
            LOCKED
          </span>
        </div>
      </div>
    </section>
  );
}

function GenAiAssessments({
  assessments,
  tab,
  onTab,
}: {
  assessments: GenAiAssessment[];
  tab: "assessments" | "project";
  onTab: (tab: "assessments" | "project") => void;
}) {
  const openItems = assessments.filter((item) => item.status === "open");
  const completed = assessments.filter((item) => item.status === "completed");
  const openCount = openItems.length;
  return (
    <section className="rounded-2xl border border-[#eaecf0] bg-white p-5 sm:p-6">
      <h2 className="font-display text-lg font-extrabold text-[#101828]">Assessments</h2>
      <p className="mt-1 text-sm text-[#667085]">
        Register, take each assessment and see your section-wise scores. Fixed dates for your batch.
      </p>
      <div className="mt-4 inline-flex rounded-lg bg-[#f2f4f7] p-1">
        <button
          type="button"
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
          onClick={() => onTab("project")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            tab === "project" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085]"
          }`}
        >
          Project Submission
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
          <div>
            <h3 className="text-sm font-semibold text-[#101828]">Your scores</h3>
            {completed.length === 0 ? (
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
      ) : (
        <div className="mt-4 rounded-xl bg-[#f9fafb] px-4 py-4">
          <p className="text-sm font-semibold text-[#101828]">GenAI project</p>
          <p className="mt-1 text-sm text-[#667085]">Submission opens after the last assessment.</p>
        </div>
      )}
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
