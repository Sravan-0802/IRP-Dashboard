import "./_group.css";
import { CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import type { ReactNode } from "react";

type HumanInterviewAttempt = {
  interviewId: string;
  interviewDate: string;
  interviewStartTime: string;
  part1Avg: number | null;
  part2Avg: number | null;
  part3Avg: number | null;
  communicationRating: number | null;
  finalScore: number | null;
  clearanceStatus: string;
};

const previewAttempt: HumanInterviewAttempt = {
  interviewId: "preview-attempt",
  interviewDate: "2026-09-19",
  interviewStartTime: "06:00 PM",
  part1Avg: 4.3,
  part2Avg: 3.8,
  part3Avg: 3.3,
  communicationRating: 4,
  finalScore: 3.8,
  clearanceStatus: "Cleared",
};

const previewData = {
  attempts: [previewAttempt],
  latestResult: previewAttempt,
  syncedAt: null,
  released: true,
};

function IrpCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={`irp-card ${className ?? ""}`}>{children}</div>;
}

function fmtScore(v: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${Number.isInteger(v) ? v : v.toFixed(2)}/5`;
}

function normStatus(s: string): "cleared" | "not_cleared" | "pending" {
  const t = (s ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (t === "cleared") return "cleared";
  if (t === "not_cleared") return "not_cleared";
  return "pending";
}

function pendingLabel(s: string): string {
  const t = (s ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!t) return "Result pending";
  if (t === "scheduled") return "Scheduled";
  if (t === "no_show") return "No show";
  if (t === "cancelled" || t === "canceled") return "Cancelled";
  return "Not completed";
}

function fmtDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d ?? "");
  if (!m) return d || "Date unavailable";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

function StatusChip({ status }: { status: string }) {
  const n = normStatus(status);
  if (n === "cleared")
    return <span className="genz-chip-cyan inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"><CheckCircle2 className="h-3.5 w-3.5" />Cleared</span>;
  if (n === "not_cleared")
    return <span className="genz-chip-pink inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"><XCircle className="h-3.5 w-3.5" />Not Cleared</span>;
  return <span className="genz-badge inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-muted2"><Clock className="h-3.5 w-3.5" />{pendingLabel(status)}</span>;
}

const PARTS: Array<[keyof HumanInterviewAttempt, string]> = [
  ["part1Avg", "Part 1"], ["part2Avg", "Part 2"], ["part3Avg", "Part 3"],
  ["communicationRating", "Communication"], ["finalScore", "Final"],
];

/**
 * Extracted from the app's HumanInterviewResults card.
 * Only its authenticated data hook is replaced with a local preview fixture.
 */
function PreviewHumanInterviewResults() {
  const data = previewData;
  const isLoading = false;
  const isError = false;
  const error: unknown = null;
  const refetch = async () => undefined;
  const isFetching = false;

  if (isLoading) {
    return (
      <IrpCard className="p-5" data-testid="hi-results-loading">
        <div className="h-4 w-44 animate-pulse rounded bg-[#f2f4f7]" />
        <div className="mt-4 h-16 animate-pulse rounded-xl bg-[#f2f4f7]" />
        <div className="mt-3 h-10 animate-pulse rounded-xl bg-[#f2f4f7]" />
      </IrpCard>
    );
  }

  if (isError) {
    return (
      <IrpCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="hi-results-error">
        <p className="text-sm font-medium text-muted2">
          Could not load your Human Interview results. {error instanceof Error ? error.message : ""}
        </p>
        <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-2 rounded-lg border border-[#eaecf0] bg-white px-3 py-1.5 text-sm font-bold text-ink2 hover:bg-surface" data-testid="button-retry-hi-results">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Retry
        </button>
      </IrpCard>
    );
  }

  if (!data || !data.released || data.attempts.length === 0) return null;

  const latest = data.latestResult;
  const latestStatus = latest ? normStatus(latest.clearanceStatus) : "pending";
  const isLatest = (a: HumanInterviewAttempt) =>
    !!latest && a.interviewId === latest.interviewId && a.interviewStartTime === latest.interviewStartTime;

  return (
    <IrpCard className="p-5 sm:p-6" data-testid="card-hi-results">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label">Human Interview</p>
          <h2 className="mt-0.5 font-display text-lg font-extrabold text-ink">Your interview results</h2>
        </div>
        {data.syncedAt ? (
          <p className="text-xs text-dim" data-testid="text-hi-synced">
            Updated {new Date(data.syncedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        ) : null}
      </div>

      <div
        className={`mt-4 rounded-xl border px-4 py-3.5 ${
          latestStatus === "cleared" ? "border-[#abefc6] bg-[#ecfdf3]" : latestStatus === "not_cleared" ? "border-[#fecdca] bg-[#fef3f2]" : "border-[#eaecf0] bg-surface"
        }`}
        data-testid="status-hi-latest"
      >
        {latest ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-muted2">Current status (latest scored interview, {fmtDate(latest.interviewDate)})</p>
              <p className="mt-0.5 font-display text-xl font-extrabold text-ink">
                {latestStatus === "cleared" ? "Cleared" : latestStatus === "not_cleared" ? "Not Cleared" : latest.clearanceStatus}
              </p>
            </div>
            <p className="text-sm font-semibold text-ink2">Final score <span className="font-mono text-base text-ink">{fmtScore(latest.finalScore)}</span></p>
          </div>
        ) : (
          <p className="text-sm font-semibold text-ink2">No scored interview yet. Your status will appear once an interview is completed and scored.</p>
        )}
      </div>

      <p className="mt-5 text-xs font-semibold text-muted2">All attempts, newest first ({data.attempts.length})</p>
      <ul className="mt-2 space-y-2.5">
        {data.attempts.map((a, i) => {
          const marked = isLatest(a);
          const done = normStatus(a.clearanceStatus) !== "pending";
          return (
            <li key={`${a.interviewId}-${i}`} className={`rounded-xl border px-4 py-3 ${marked ? "border-[#d6bbfb] bg-l1-bg" : "border-[#eaecf0] bg-white"}`} data-testid={`row-hi-attempt-${i}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">{fmtDate(a.interviewDate)}</span>
                  {a.interviewStartTime ? <span className="text-xs text-muted2">{a.interviewStartTime}</span> : null}
                  {marked ? <span className="rounded-full bg-l1 px-2 py-0.5 text-[11px] font-bold text-white">Latest result</span> : null}
                </div>
                <StatusChip status={a.clearanceStatus} />
              </div>
              {done || PARTS.some(([k]) => a[k] !== null) ? (
                <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-5">
                  {PARTS.map(([k, label]) => (
                    <div key={k}>
                      <dt className="text-[11px] text-muted2">{label}</dt>
                      <dd className={`font-mono text-sm ${k === "finalScore" ? "font-bold text-ink" : "text-ink2"}`}>{fmtScore(a[k] as number | null)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-1.5 text-xs text-muted2">
                  {a.clearanceStatus.trim() ? "This interview was not completed, so no scores are recorded." : "Your interview result is pending."}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </IrpCard>
  );
}

export function Current() {
  return (
    <main className="min-h-screen bg-[#f5f5f5] px-5 py-8 font-sans text-ink sm:px-10">
      <div className="mx-auto max-w-[850px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-label">Student dashboard preview</p>
            <h1 className="mt-1 font-display text-xl font-extrabold tracking-tight">Prehan Viral Shah</h1>
          </div>
          <span className="rounded-full border border-[#fedf89] bg-[#fffaeb] px-3 py-1.5 text-xs font-bold text-[#b54708]">
            Preview only · results not released
          </span>
        </div>
        <PreviewHumanInterviewResults />
        <p className="mt-3 text-[11px] text-muted2">
          Isolated preview of the development result. The live release setting and student data are unchanged.
        </p>
      </div>
    </main>
  );
}
