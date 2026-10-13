import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import type { StepStatus } from "@/components/irp/ui";
import { l1HustlerJourneySteps } from "@/lib/l1JourneySteps";
import { useVisibilitySettings } from "@/lib/useVisibilitySettings";
import { useFeProjectConfig } from "@/lib/useFeProjectConfig";

const TOPIN_GUIDELINES_URL = "https://bit.ly/placement-assessment-guidelines";
const FE_GUIDELINES_URL =
  "https://docs.google.com/document/d/11ppsy40_mCRL5qaeUp_1iO9ygl0j46Ub3elZu6XsPnc/edit?tab=t.0";

type StageId = "online" | "fe" | "interview";

interface StageCopy {
  id: StageId;
  stepLabel: string;
  title: string;
  points: string[];
  url: string | null;
  activeHint: string;
}

const STAGES: StageCopy[] = [
  {
    id: "online",
    stepLabel: "Online Assessment",
    title: "L1 Online Assessment",
    points: [
      "Test format, sections and duration",
      "Allowed tools and proctoring rules",
      "Qualifying score and how results work",
      "What to do if something goes wrong",
    ],
    url: TOPIN_GUIDELINES_URL,
    activeHint: "Read before you start",
  },
  {
    id: "fe",
    stepLabel: "FE Project",
    title: "FE Project",
    points: [
      "Problem statement and deliverables",
      "Submission format and deadline",
      "Scoring rubric (18/20 to qualify)",
      "Common mistakes and plagiarism policy",
    ],
    url: FE_GUIDELINES_URL,
    activeHint: "Read before you submit",
  },
  {
    id: "interview",
    stepLabel: "Human Interview",
    title: "Human Interview",
    points: [
      "Book your slot from the Interview Slot Selection email",
      "Follow the Pre-Interview Checklist",
      "Complete the Self-Declaration with the panelist",
      "Integrity Score is required before the interview",
    ],
    url: null,
    activeHint: "Read before your interview",
  },
];

function storageKey(userId: string): string {
  return `irp-guideline-read:${userId || "local"}`;
}

function loadRead(userId: string): Record<StageId, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(userId)) || "{}") as Partial<Record<StageId, boolean>>;
    return { online: !!raw.online, fe: !!raw.fe, interview: !!raw.interview };
  } catch {
    return { online: false, fe: false, interview: false };
  }
}

export function GuidelineDocs({
  journey,
  assessments,
  userId,
}: {
  journey: Journey;
  assessments: AssessmentResult[];
  userId: string;
}) {
  const { settings } = useVisibilitySettings();
  const { minScore: feProjectMinScore } = useFeProjectConfig();
  const [read, setRead] = useState<Record<StageId, boolean>>(() => loadRead(userId));
  const [processOpen, setProcessOpen] = useState(false);

  useEffect(() => {
    setRead(loadRead(userId));
  }, [userId]);

  const steps = useMemo(
    () =>
      l1HustlerJourneySteps(journey, assessments, null, settings, feProjectMinScore, userId),
    [journey, assessments, settings, feProjectMinScore, userId],
  );

  function statusFor(label: string): StepStatus {
    return steps.find((step) => step.label === label)?.status ?? "locked";
  }

  function markRead(id: StageId) {
    const next = { ...read, [id]: true };
    setRead(next);
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch {
      // ignore private-mode storage failures
    }
  }

  function openStage(stage: StageCopy, status: StepStatus) {
    if (status === "locked") return;
    markRead(stage.id);
    if (stage.url) {
      window.open(stage.url, "_blank", "noopener,noreferrer");
      return;
    }
    setProcessOpen(true);
  }

  const view = STAGES.map((stage) => {
    const status = statusFor(stage.stepLabel);
    const done = status === "done";
    const locked = status === "locked";
    const pct = locked ? 0 : done || read[stage.id] ? 100 : 0;
    return { stage, status, done, locked, pct };
  });
  const recommended = view.find((item) => !item.done && !item.locked)?.stage.id;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#101828] sm:text-[28px]">
          Guideline Docs
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Official rules and prep guides for each IRP stage. Read the one for your current stage first.
        </p>
      </div>

      <section className="grid gap-3 lg:grid-cols-3">
        {view.map(({ stage, done, locked, pct, status }) => {
          const recommendedNow = stage.id === recommended;
          const border = recommendedNow ? "border-[#6941c6] shadow-[0_0_0_1px_#6941c6]" : "border-[#eaecf0]";
          const badge = done ? "YOU QUALIFIED" : locked ? "UNLOCKS LATER" : recommendedNow ? "RECOMMENDED NOW" : "IN PROGRESS";
          const badgeClass = done
            ? "bg-[#ecfdf3] text-[#067647]"
            : locked
              ? "bg-[#f2f4f7] text-[#667085]"
              : "bg-[#f4f3ff] text-[#6941c6]";
          const bar = done ? "bg-[#12b76a]" : locked ? "bg-[#eaecf0]" : "bg-[#6941c6]";
          const hint = done ? "For reference" : locked ? "Read ahead" : stage.activeHint;
          const barLabel = pct === 100 ? "Read" : locked ? "Not opened" : "Not opened";
          return (
            <article key={stage.id} className={`flex flex-col rounded-2xl border bg-white p-4 ${border}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f3ff] text-[#6941c6]">
                  <FileText className="h-4 w-4" />
                </span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold tracking-wide ${badgeClass}`}>{badge}</span>
              </div>
              <h3 className="mt-3 font-display text-base font-extrabold text-[#101828]">{stage.title}</h3>
              <p className="text-xs text-[#98a2b3]">Guidelines</p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-[#344054]">
                {stage.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#98a2b3]" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] font-semibold text-[#667085]">
                  <span>{hint}</span>
                  <span>{barLabel}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f2f4f7]">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <button
                type="button"
                disabled={locked}
                onClick={() => openStage(stage, status)}
                className={
                  locked
                    ? "mt-4 w-full cursor-not-allowed rounded-lg border border-[#eaecf0] py-2.5 text-sm font-semibold text-[#98a2b3]"
                    : recommendedNow
                      ? "mt-4 w-full rounded-lg bg-[#6941c6] py-2.5 text-sm font-bold text-white hover:bg-[#5925dc]"
                      : "mt-4 w-full rounded-lg border border-[#d0d5dd] py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#f9fafb]"
                }
              >
                Open guideline doc
              </button>
            </article>
          );
        })}
      </section>

      {processOpen ? <InterviewProcess onClose={() => { markRead("interview"); setProcessOpen(false); }} /> : null}
    </div>
  );
}

function InterviewProcess({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="font-display text-lg font-extrabold text-[#101828]">Human Interview process</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#344054]">
          <p className="font-bold text-[#101828]">Step 1: Book your interview slot</p>
          <p>
            You will receive an Interview Slot Selection email. Once you receive it, select and book your interview slot.
            Use the Candidate Interview Slot Selection Guide in the Interview Coordinator app.
          </p>
          <p className="font-bold text-[#101828]">Step 2: Integrity Score</p>
          <p>
            An Integrity Score is now part of the Technical Interview evaluation. Follow the Pre-Interview Checklist and
            complete the required Self-Declaration with the panelist before the interview begins.
          </p>
          <p>
            The checklist and Self-Declaration are in the Candidate Interview Handbook. Both are mandatory for the
            Integrity Score.
          </p>
          <p>
            After the slot-selection email arrives, book your slot, complete the pre-interview requirements, and come
            prepared.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-[#6941c6] py-2.5 text-sm font-bold text-white hover:bg-[#5925dc]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
