import { useState } from "react";
import {
  BarChart3,
  Check,
  ClipboardList,
  Clock,
  Code2,
  Eye,
  FileText,
  Info,
  Laptop,
  Lock,
  LockOpen,
  Medal,
  MessageCircle,
  Users,
  X,
} from "lucide-react";
import type { JourneyStep } from "./ui";
import { L1CoursesDialog } from "./LevelCoursesDialog";
import {
  ClearCardDialog,
  type BadgeThemeId,
  type OnlineBadgeStudent,
} from "./OnlineAssessmentBadge";

export type Tone = "done" | "failed" | "active" | "locked";

function toneOf(status: JourneyStep["status"]): Tone {
  if (status === "done") return "done";
  if (status === "attempted_not_cleared") return "failed";
  if (status === "active" || status === "reattempt") return "active";
  return "locked";
}

function stepByLabel(steps: JourneyStep[], label: string): JourneyStep | undefined {
  return steps.find((step) => step.label === label);
}

const STAGE_META: {
  label: string;
  themeId: BadgeThemeId | null;
  Icon: typeof FileText;
  completedBody: string;
  failedBody: string;
  activeBody: string;
  lockedBody: string;
}[] = [
  {
    label: "Online Assessment",
    themeId: "online",
    Icon: FileText,
    completedBody: "You have qualified in the Level 1 online assessment.",
    failedBody: "Your online assessment is not a qualifying score yet.",
    activeBody: "Complete the Level 1 online assessment to earn this clear card.",
    lockedBody: "This stage unlocks when your online assessment opens.",
  },
  {
    label: "FE Project",
    themeId: "fe",
    Icon: Code2,
    completedBody: "You cleared the Frontend Project.",
    failedBody: "Complete the Frontend Project to move to the next stage.",
    activeBody: "Complete the Frontend Project to move to the next stage.",
    lockedBody: "Qualify in the online assessment to unlock the FE Project.",
  },
  {
    label: "Human Interview",
    themeId: "panel",
    Icon: Users,
    completedBody: "You cleared the Human Interview.",
    failedBody: "Your latest Human Interview result is not cleared yet.",
    activeBody: "Complete your Human Interview to earn this clear card.",
    lockedBody: "Complete the FE Project to unlock this stage.",
  },
  {
    label: "Level 2 Access",
    themeId: null,
    Icon: BarChart3,
    completedBody: "Level 2 access is unlocked.",
    failedBody: "Complete all Level 1 stages to unlock Level 2.",
    activeBody: "Level 2 access is opening.",
    lockedBody: "Complete all Level 1 stages to unlock Level 2.",
  },
];

function headerCopy(steps: JourneyStep[], required: number): string {
  const online = toneOf(stepByLabel(steps, "Online Assessment")?.status ?? "locked");
  const fe = toneOf(stepByLabel(steps, "FE Project")?.status ?? "locked");
  const human = toneOf(stepByLabel(steps, "Human Interview")?.status ?? "locked");
  if (online !== "done") {
    return "Qualify in the Level 1 online assessment to start collecting your IRP Clear Cards.";
  }
  if (fe === "failed") {
    return "You have qualified in the online assessment. Your FE project score is available on the dashboard. A re-attempt link will appear when released.";
  }
  if (fe !== "done") {
    return "You have qualified in the online assessment. Qualify in the FE Project to continue.";
  }
  if (human !== "done") {
    return "You cleared the FE Project. Complete the Human Interview to keep collecting your IRP Clear Cards.";
  }
  return "You completed every Level 1 stage. Level 2 is unlocked.";
}

function bodyCopy(meta: (typeof STAGE_META)[number], tone: Tone): string {
  if (tone === "done") return meta.completedBody;
  if (tone === "failed") return meta.failedBody;
  if (tone === "active") return meta.activeBody;
  return meta.lockedBody;
}

export const RAIL_DOT: Record<Tone, string> = {
  done: "bg-[#16a34a] text-white shadow-[0_0_0_4px_#dcfce7]",
  failed: "bg-[#f97316] text-white shadow-[0_0_0_4px_#ffedd5,0_0_18px_rgba(249,115,22,0.45)]",
  active: "bg-[#2563eb] text-white shadow-[0_0_0_4px_#dbeafe]",
  locked: "bg-[#e4e7ec] text-[#667085] shadow-[0_0_0_4px_#f2f4f7]",
};

/** Rail segment leading into a stage, coloured by that stage's state. */
export const RAIL_SEGMENT: Record<Tone, string> = {
  done: "h-[3px] rounded-full bg-[#16a34a]",
  failed: "h-[3px] rounded-full bg-[linear-gradient(90deg,#16a34a_0%,#f97316_100%)]",
  active: "h-[3px] rounded-full bg-[linear-gradient(90deg,#16a34a_0%,#2563eb_100%)]",
  locked: "h-0 border-t-[3px] border-dashed border-[#d0d5dd]",
};

export const CARD_SURFACE: Record<Tone, string> = {
  done: "border-[#bbf7d0] bg-[linear-gradient(180deg,#f0fdf4_0%,#ffffff_60%)]",
  failed: "border-[#fed7aa] bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_60%)]",
  active: "border-[#bfdbfe] bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_60%)]",
  locked: "border-[#e4e7ec] bg-[linear-gradient(180deg,#f9fafb_0%,#ffffff_60%)]",
};

const ILLUSTRATION_TILE: Record<Tone, string> = {
  done: "bg-[linear-gradient(135deg,#dcfce7_0%,#f0fdf4_100%)] text-[#16a34a]",
  failed: "bg-[linear-gradient(135deg,#ffedd5_0%,#fff7ed_100%)] text-[#ea580c]",
  active: "bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_100%)] text-[#2563eb]",
  locked: "bg-[linear-gradient(135deg,#eaecf0_0%,#f9fafb_100%)] text-[#98a2b3]",
};

const STAGE_ICON: Record<string, typeof FileText> = {
  "Online Assessment": ClipboardList,
  "FE Project": Laptop,
  "Human Interview": Users,
  "Level 2 Access": LockOpen,
};

function StageIllustration({ label, tone }: { label: string; tone: Tone }) {
  return (
    <IllustrationTile icon={STAGE_ICON[label] ?? FileText} tone={tone} chat={label === "Human Interview"} />
  );
}

/** Large stage icon tile: tick badge when done, chat bubble for interview stages in progress. */
export function IllustrationTile({ icon, tone, chat = false }: { icon: typeof FileText; tone: Tone; chat?: boolean }) {
  const Icon = tone === "locked" ? Lock : icon;
  return (
    <span className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${ILLUSTRATION_TILE[tone]}`}>
      <span aria-hidden className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-current opacity-30" />
      <span aria-hidden className="absolute bottom-3 left-1.5 h-1 w-1 rounded-full bg-current opacity-25" />
      <Icon className="h-8 w-8" strokeWidth={1.75} />
      {tone === "done" ? (
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#16a34a] text-white ring-2 ring-white">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      ) : chat && tone !== "locked" ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#ea580c] shadow-[0_2px_6px_rgba(16,24,40,0.12)]">
          <MessageCircle className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </span>
  );
}

export function IrpClearCards({
  steps,
  student,
  feMinScore,
}: {
  steps: JourneyStep[];
  student: OnlineBadgeStudent;
  feMinScore: number;
}) {
  const [viewing, setViewing] = useState<BadgeThemeId | null>(null);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const earned = steps.filter((step) => step.status === "done").length;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#f6ead8] bg-white shadow-[0_8px_30px_rgba(16,24,40,0.04)]">
      <div className="bg-[linear-gradient(90deg,#fff6ea_0%,#fffaf4_42%,#ffffff_100%)] px-4 py-5 sm:px-6">
        <span className="inline-flex items-center rounded-full border border-[#fdba74] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#ea580c]">
          Level 1
        </span>
        <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight text-[#111827] sm:text-2xl">
          Complete all stages to unlock Level 2
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[#667085]">
          {headerCopy(steps, feMinScore)}
        </p>
      </div>

      <div className="px-3 py-4 sm:px-5 sm:py-5">
        <ol aria-hidden className="relative mb-4 hidden grid-cols-4 gap-4 xl:grid">
          {STAGE_META.map((meta, index) => {
            const tone = toneOf(stepByLabel(steps, meta.label)?.status ?? "locked");
            const next = STAGE_META[index + 1];
            const nextTone = next ? toneOf(stepByLabel(steps, next.label)?.status ?? "locked") : null;
            return (
              <li key={meta.label} className="relative flex justify-center">
                {nextTone ? (
                  <span
                    className={`absolute left-[calc(50%+22px)] top-1/2 w-[calc(100%-44px+1rem)] -translate-y-1/2 ${RAIL_SEGMENT[nextTone]}`}
                  />
                ) : null}
                <span
                  className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold ${RAIL_DOT[tone]}`}
                >
                  {index + 1}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STAGE_META.map((meta, index) => {
            const step = stepByLabel(steps, meta.label);
            const tone = toneOf(step?.status ?? "locked");
            const canDownload = tone === "done" && meta.themeId != null;
            const innerLabel = step?.badgeLabel;
            const opensCourses = meta.label === "Online Assessment";
            return (
              <div key={meta.label} className="contents">
                <article
                  onClick={
                    opensCourses
                      ? (event) => {
                          if ((event.target as HTMLElement).closest("button, a")) return;
                          setCoursesOpen(true);
                        }
                      : undefined
                  }
                  data-testid={opensCourses ? "card-online-assessment" : undefined}
                  className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-4 shadow-[0_4px_16px_rgba(16,24,40,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(16,24,40,0.10)] sm:p-5 ${CARD_SURFACE[tone]} ${
                    opensCourses ? "cursor-pointer" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <StageIllustration label={meta.label} tone={tone} />
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusPill tone={tone} />
                      {opensCourses ? (
                        <button
                          type="button"
                          onClick={() => setCoursesOpen(true)}
                          data-testid="button-view-l1-courses"
                          className="inline-flex items-center gap-1 rounded-full border border-[#bfdbfe] bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-[#2563eb] transition-colors hover:border-[#93c5fd] hover:bg-[#eff6ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                        >
                          <Info className="h-3 w-3" />
                          How to clear?
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <h3 className="mt-4 flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#111827]">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold xl:hidden ${RAIL_DOT[tone]}`}
                    >
                      {index + 1}
                    </span>
                    {meta.label}
                  </h3>
                  {tone === "done" && innerLabel ? (
                    <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
                      <Check className="h-3 w-3" />
                      {innerLabel}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm leading-relaxed text-[#667085]">{bodyCopy(meta, tone)}</p>
                  {meta.label === "FE Project" && tone === "failed" ? (
                    <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff7ed] px-3 py-2 text-xs font-semibold leading-relaxed text-[#c2410c]">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Re-attempt link will appear when released.
                    </p>
                  ) : null}

                  <div className="mt-auto pt-4">
                    {canDownload && meta.themeId ? (
                      <span className="block rounded-xl bg-[linear-gradient(135deg,#c4b5fd_0%,#93c5fd_100%)] p-px shadow-[0_6px_16px_rgba(105,65,198,0.25)]">
                        <button
                          type="button"
                          onClick={() => setViewing(meta.themeId)}
                          className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-[linear-gradient(135deg,#6941c6_0%,#7f56d9_100%)] px-3 py-2.5 text-sm font-extrabold text-white transition-opacity hover:opacity-90"
                        >
                          <Eye className="h-4 w-4" />
                          View IRP Clear Card
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#e4e7ec] bg-[#f2f4f7]/80 px-3 py-2.5 text-sm font-bold text-[#98a2b3]"
                      >
                        <Lock className="h-4 w-4" />
                        IRP Clear Card Locked
                      </button>
                    )}
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </div>
      <L1CoursesDialog open={coursesOpen} onOpenChange={setCoursesOpen} />
      <ClearCardDialog
        open={viewing != null}
        themeId={viewing ?? "online"}
        student={student}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />

      <div className="mx-3 mb-3 flex flex-col gap-4 rounded-2xl border border-[#ece8ff] bg-[linear-gradient(90deg,#f7f5ff_0%,#faf8ff_55%,#f5f8ff_100%)] px-4 py-4 sm:mx-5 sm:mb-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 lg:w-[19rem] lg:shrink-0">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#fef0c7_0%,#fdb022_100%)] text-white shadow-[0_6px_14px_rgba(247,144,9,0.35)]">
            <Medal className="h-6 w-6" />
          </span>
          <div>
            <p className="text-base font-extrabold text-[#111827]">Your IRP Clear Cards ({earned}/4 earned)</p>
            <p className="text-xs text-[#667085]">Complete each stage and download your IRP Clear Cards here.</p>
          </div>
        </div>
        <span aria-hidden className="hidden h-12 w-px bg-[#e4e0f5] lg:block" />
        <div className="flex flex-wrap gap-2">
          {STAGE_META.map((meta, index) => {
            const tone = toneOf(stepByLabel(steps, meta.label)?.status ?? "locked");
            return (
              <span
                key={meta.label}
                className="inline-flex items-center gap-2 rounded-full border border-[#eef0f4] bg-white py-1 pl-1 pr-1.5 text-xs font-bold text-[#344054] shadow-[0_1px_3px_rgba(16,24,40,0.06)]"
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${RAIL_DOT[tone]}`}>
                  {index + 1}
                </span>
                {meta.label}
                <StatusPill tone={tone} />
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function StatusPill({ tone }: { tone: Tone }) {
  const label =
    tone === "done" ? "Completed" : tone === "failed" ? "Not Cleared" : tone === "active" ? "In progress" : "Locked";
  const className =
    tone === "done"
      ? "bg-[#ecfdf3] text-[#15803d]"
      : tone === "failed"
        ? "bg-[#fef2f2] text-[#e11d48]"
        : tone === "active"
          ? "bg-[#eff6ff] text-[#1d4ed8]"
          : "bg-[#f3f4f6] text-[#98a2b3]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`}>
      {tone === "done" ? <Check className="h-3 w-3" /> : tone === "failed" ? <X className="h-3 w-3" /> : tone === "locked" ? <Lock className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}
