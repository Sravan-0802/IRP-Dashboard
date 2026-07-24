import { AlertTriangle, Lock, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatNxtmockRating,
  NXTMOCK_RATING_MAX,
  nxtmockRatingPct,
  type NxtmockInterview,
} from "@/lib/nxtmockInterview";
import {
  NXTMOCK_CLEARED_BODY,
  NXTMOCK_CLEARED_TITLE,
  NXTMOCK_NOT_CLEARED_BODY,
  NXTMOCK_NOT_CLEARED_EYEBROW,
  NXTMOCK_NOT_CLEARED_TITLE,
  NXTMOCK_RESULTS_TITLE,
} from "@/lib/nxtmockConfig";
import { ProgressRing, Pill } from "./ui";

const SKILL_ROWS: { key: keyof NxtmockInterview; label: string }[] = [
  { key: "selfIntroRating", label: "Self introduction" },
  { key: "javascriptCodingRating", label: "JavaScript coding" },
  { key: "javascriptRating", label: "JavaScript" },
  { key: "cssRating", label: "CSS" },
  { key: "htmlRating", label: "HTML" },
  { key: "reactJsRating", label: "React" },
];

export function NxtmockResults({
  interview,
  visible = true,
}: {
  interview: NxtmockInterview | null | undefined;
  visible?: boolean;
}) {
  if (!interview) return null;

  if (!visible) {
    return (
      <div
        id="nxtmock-results"
        className="scroll-mt-24 flex items-center gap-2.5 rounded-2xl border border-[rgba(103,65,217,0.1)] bg-white px-4 py-3 shadow-soft"
      >
        <Lock className="h-4 w-4 shrink-0 text-muted2" />
        <p className="text-xs font-medium text-muted2">
          AI Mock Interview results are being processed. They will appear here once released.
        </p>
      </div>
    );
  }

  const cleared = interview.cleared;
  const avgPct = nxtmockRatingPct(interview.averageRating);
  const title = interview.interviewTitle?.trim() || "AI Mock Interview";

  return (
    <div
      id="nxtmock-results"
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-white p-5 shadow-soft sm:p-6",
        cleared ? "border-[rgba(12,166,120,0.22)]" : "border-[rgba(236,72,153,0.18)]",
      )}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-extrabold">
            <Mic className={cn("h-4 w-4", cleared ? "text-teal" : "text-brand-2")} />
            <span className={cleared ? "text-teal" : "text-gradient-brand"}>{NXTMOCK_RESULTS_TITLE}</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted2">{title}</p>
        </div>
        <Pill tone={cleared ? "green" : "amber"}>
          {cleared ? "Cleared" : "Not cleared"}
        </Pill>
      </div>

      {cleared ? (
        <div className="mb-5 rounded-xl border border-[rgba(12,166,120,0.2)] bg-white px-4 py-3">
          <p className="font-display text-sm font-extrabold text-ink">{NXTMOCK_CLEARED_TITLE}</p>
          <p className="mt-0.5 text-xs text-muted2">{NXTMOCK_CLEARED_BODY}</p>
        </div>
      ) : (
        <div
          className="mb-5 rounded-xl border border-[rgba(245,159,0,0.28)] bg-white p-4"
          aria-labelledby="nxtmock-not-cleared-title"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#e67700] shadow-sm ring-1 ring-[rgba(245,159,0,0.15)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e67700]">
                {NXTMOCK_NOT_CLEARED_EYEBROW}
              </p>
              <h4
                id="nxtmock-not-cleared-title"
                className="font-display text-base font-extrabold text-ink"
              >
                {NXTMOCK_NOT_CLEARED_TITLE}
              </h4>
              <p className="mt-0.5 text-sm text-muted2">{NXTMOCK_NOT_CLEARED_BODY}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill tone="amber">
                  Your average · {formatNxtmockRating(interview.averageRating)}/{NXTMOCK_RATING_MAX}
                </Pill>
                <Pill tone="green">Required · {interview.clearThreshold}+ average rating</Pill>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-white shadow-soft",
          cleared ? "border-[rgba(12,166,120,0.16)]" : "border-[rgba(236,72,153,0.16)]",
        )}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,240px)_1fr]">
          <div
            className={cn(
              "flex flex-col items-center justify-center border-b bg-white px-6 py-8 lg:border-b-0 lg:border-r",
              cleared
                ? "border-[rgba(12,166,120,0.12)] lg:border-r-[rgba(12,166,120,0.12)]"
                : "border-[rgba(236,72,153,0.12)] lg:border-r-[rgba(236,72,153,0.12)]",
            )}
          >
            <ProgressRing
              value={avgPct}
              tone={cleared ? "green" : "pink"}
              label="Average"
              size={108}
              strokeWidth={10}
            />
            <p className="mt-4 font-display text-3xl font-black leading-none text-ink">
              {formatNxtmockRating(interview.averageRating)}
              <span className="text-lg font-semibold text-dim">/{NXTMOCK_RATING_MAX}</span>
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted2">
              Overall average
            </p>
          </div>

          <div className="bg-white p-4 sm:p-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted2">
              Skill-wise breakdown
            </p>
            <div className="space-y-3.5">
              {SKILL_ROWS.map(({ key, label }) => {
                const value = interview[key];
                const numeric = typeof value === "number" ? value : null;
                return (
                  <SkillRatingRow
                    key={key}
                    label={label}
                    rating={numeric}
                    cleared={cleared}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillRatingRow({
  label,
  rating,
  cleared,
}: {
  label: string;
  rating: number | null;
  cleared: boolean;
}) {
  const pct = nxtmockRatingPct(rating);
  const display = formatNxtmockRating(rating);
  const hasScore = rating != null && Number.isFinite(rating);
  const strong = hasScore && rating >= 7;
  const pass = hasScore && rating >= 5;

  const fill = !hasScore
    ? cleared
      ? "rgba(12,166,120,0.15)"
      : "rgba(103,65,217,0.15)"
    : strong
      ? "linear-gradient(90deg,#0ca678,#2f9e44)"
      : pass
        ? "linear-gradient(90deg,#3b82f6,#6741d9)"
        : "linear-gradient(90deg,#f59f00,#e67700)";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(110px,140px)_1fr_auto]">
      <p className="truncate text-sm font-semibold text-ink">{label}</p>
      <div
        className={cn(
          "col-span-2 h-2.5 overflow-hidden rounded-full sm:col-span-1 sm:col-start-2",
          cleared ? "bg-[rgba(12,166,120,0.12)]" : "bg-[rgba(236,72,153,0.12)]",
        )}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: hasScore ? `${pct}%` : "0%", background: fill }}
        />
      </div>
      <p className="text-right text-sm font-bold tabular-nums text-ink sm:col-start-3">
        {display}
        {hasScore ? <span className="text-xs font-semibold text-dim">/{NXTMOCK_RATING_MAX}</span> : null}
      </p>
    </div>
  );
}
