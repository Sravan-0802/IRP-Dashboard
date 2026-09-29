import { useState } from "react";
import {
  BarChart3,
  Check,
  ChevronRight,
  Clock,
  Code2,
  FileText,
  Lock,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { JourneyStep } from "./ui";
import {
  ClearCardDialog,
  downloadOnlineAssessmentBadge,
  type BadgeThemeId,
  type OnlineBadgeStudent,
} from "./OnlineAssessmentBadge";

type Tone = "done" | "failed" | "active" | "locked";

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
    completedBody: "You completed the Human Interview.",
    failedBody: "Complete the Human Interview to earn this clear card.",
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
    return `You have qualified in the online assessment. Your FE project score is available on the dashboard. A re-attempt link will appear when released. Score ≥ ${required}/20 to continue.`;
  }
  if (fe !== "done") {
    return `You have qualified in the online assessment. Score ${required}/20 or above on the FE Project to continue.`;
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

function footerLabel(tone: Tone, earned: boolean): string {
  if (earned) return "Downloaded";
  if (tone === "failed") return "Not Cleared";
  if (tone === "active") return "In progress";
  return "Locked";
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
  const [busy, setBusy] = useState<BadgeThemeId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const earned = steps.filter((step) => step.status === "done").length;

  async function onDownload(themeId: BadgeThemeId) {
    setError(null);
    setBusy(themeId);
    try {
      await downloadOnlineAssessmentBadge(student, themeId);
    } catch {
      setError("Could not download the IRP Clear Card. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#f6ead8] bg-white shadow-[0_8px_30px_rgba(16,24,40,0.04)]">
      <div className="bg-[linear-gradient(90deg,#fff6ea_0%,#fffaf4_42%,#ffffff_100%)] px-4 py-5 sm:px-6">
        <span className="inline-flex items-center rounded-full border border-[#fdba74] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#ea580c]">
          Level 1
        </span>
        <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight text-[#111827] sm:text-2xl">
          Complete all stages to unlock Level 2 <span aria-hidden>💪</span>
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[#667085]">
          {headerCopy(steps, feMinScore)}
        </p>
      </div>

      <div className="px-3 py-4 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
          {STAGE_META.map((meta, index) => {
            const step = stepByLabel(steps, meta.label);
            const tone = toneOf(step?.status ?? "locked");
            const Icon = meta.Icon;
            const canDownload = tone === "done" && meta.themeId != null;
            const innerLabel = step?.badgeLabel;
            return (
              <div key={meta.label} className="contents">
                <article
                  className={`flex min-w-0 flex-1 flex-col rounded-2xl border bg-white p-4 ${
                    tone === "done"
                      ? "border-[#86efac]"
                      : tone === "failed"
                        ? "border-[#fdba74]"
                        : tone === "active"
                          ? "border-[#93c5fd]"
                          : "border-[#e5e7eb]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold text-white ${
                        tone === "done"
                          ? "bg-[#16a34a]"
                          : tone === "failed"
                            ? "bg-[#f97316]"
                            : tone === "active"
                              ? "bg-[#2563eb]"
                              : "bg-[#d1d5db]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <StatusPill tone={tone} />
                  </div>

                  <span
                    className={`mt-4 flex h-11 w-11 items-center justify-center rounded-xl ${
                      tone === "done"
                        ? "bg-[#ecfdf3] text-[#16a34a]"
                        : tone === "failed"
                          ? "bg-[#fff7ed] text-[#f97316]"
                          : tone === "active"
                            ? "bg-[#eff6ff] text-[#2563eb]"
                            : "bg-[#f3f4f6] text-[#9ca3af]"
                    }`}
                  >
                    {tone === "locked" ? <Lock className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </span>

                  <h3 className="mt-3 text-base font-extrabold text-[#111827]">{meta.label}</h3>
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
                      <div className="flex w-fit flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setViewing(meta.themeId)}
                          className="inline-flex w-full items-center justify-center rounded-xl border border-[#d0d5dd] bg-white px-3 py-2 text-xs font-extrabold text-[#111827] transition-colors hover:bg-[#f9fafb]"
                        >
                          View IRP Clear Card
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDownload(meta.themeId as BadgeThemeId)}
                          disabled={busy === meta.themeId}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-[#6941c6] px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-[#5925dc] disabled:opacity-60"
                        >
                          {busy === meta.themeId ? "Downloading…" : "Download IRP Clear Card"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2.5 text-sm font-bold text-[#98a2b3]"
                      >
                        <Lock className="h-4 w-4" />
                        IRP Clear Card Locked
                      </button>
                    )}
                  </div>
                </article>
                {index < STAGE_META.length - 1 ? (
                  <span
                    className={`hidden h-7 w-7 shrink-0 items-center justify-center self-center rounded-full xl:flex ${
                      tone === "done" ? "bg-[#dcfce7] text-[#16a34a]" : "bg-[#f3f4f6] text-[#d1d5db]"
                    }`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        {error ? <p className="mt-3 text-xs font-medium text-[#b42318]">{error}</p> : null}
      </div>
      <ClearCardDialog
        open={viewing != null}
        themeId={viewing ?? "online"}
        student={student}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />

      <div className="mx-3 mb-3 flex flex-col gap-3 rounded-2xl bg-[#fff7ed] px-4 py-3 sm:mx-5 sm:mb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#f97316] shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-[#111827]">
              Your IRP Clear Cards ({earned}/4 earned)
            </p>
            <p className="text-xs text-[#667085]">Complete each stage and download your IRP Clear Cards here.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {STAGE_META.map((meta, index) => {
            const tone = toneOf(stepByLabel(steps, meta.label)?.status ?? "locked");
            const earnedCard = tone === "done";
            return (
              <span
                key={meta.label}
                className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#344054] shadow-sm"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${
                    earnedCard ? "bg-[#16a34a]" : tone === "failed" ? "bg-[#f97316]" : "bg-[#d1d5db]"
                  }`}
                >
                  {index + 1}
                </span>
                {meta.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    earnedCard
                      ? "bg-[#ecfdf3] text-[#15803d]"
                      : tone === "failed"
                        ? "bg-[#fff7ed] text-[#c2410c]"
                        : tone === "active"
                          ? "bg-[#eff6ff] text-[#1d4ed8]"
                          : "bg-[#f3f4f6] text-[#98a2b3]"
                  }`}
                >
                  {footerLabel(tone, earnedCard)}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StatusPill({ tone }: { tone: Tone }) {
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
