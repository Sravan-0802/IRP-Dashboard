import { CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import type { GenaiHumanInterviewAttempt } from "@workspace/api-client-react";
import { useGenaiHumanInterviewResults } from "@/lib/useGenaiHumanInterviewResults";

export const GENAI_HUMAN_INTERVIEW_SECTION_ID = "genai-human-interview-results";

const SECTIONS: Array<{
  rating: "projectRating" | "conceptRating" | "dsaRating" | "communicationRating";
  remarks: "projectRemarks" | "conceptRemarks" | "dsaRemarks" | "communicationRemarks";
  title: string;
  weight: string;
}> = [
  { rating: "projectRating", remarks: "projectRemarks", title: "Project Discussion and Live Modification", weight: "40%" },
  { rating: "conceptRating", remarks: "conceptRemarks", title: "GenAI Concepts", weight: "30%" },
  { rating: "dsaRating", remarks: "dsaRemarks", title: "Basic DSA", weight: "20%" },
  { rating: "communicationRating", remarks: "communicationRemarks", title: "Communication", weight: "10%" },
];

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
  if (t === "partially_completed") return "Partially completed";
  return "Not completed";
}

function fmtRating(v: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${Number.isInteger(v) ? v : v.toFixed(1)} / 5`;
}

function fmtFinal(v: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${Number.isInteger(v) ? v : v.toFixed(1)} / 100`;
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
  if (n === "cleared") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf3] px-2.5 py-0.5 text-xs font-bold text-[#067647]">
        <CheckCircle2 className="h-3.5 w-3.5" />Cleared
      </span>
    );
  }
  if (n === "not_cleared") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#fef3f2] px-2.5 py-0.5 text-xs font-bold text-[#b42318]">
        <XCircle className="h-3.5 w-3.5" />Not Cleared
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f7] px-2.5 py-0.5 text-xs font-bold text-[#475467]">
      <Clock className="h-3.5 w-3.5" />{pendingLabel(status)}
    </span>
  );
}

function hasScores(a: GenaiHumanInterviewAttempt): boolean {
  return a.finalScore !== null || SECTIONS.some((s) => a[s.rating] !== null);
}

/** GenAI Track human interview results (Academy Nexus irp-gen-ai), shown once released. */
export function GenaiHumanInterviewResults() {
  const { data, isLoading, isError, refetch, isFetching } = useGenaiHumanInterviewResults();

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-[#eaecf0] bg-white p-5" data-testid="genai-hi-results-loading">
        <div className="h-4 w-44 animate-pulse rounded bg-[#f2f4f7]" />
        <div className="mt-4 h-16 animate-pulse rounded-xl bg-[#f2f4f7]" />
      </section>
    );
  }

  if (isError) {
    return (
      <section
        className="flex flex-col gap-3 rounded-2xl border border-[#eaecf0] bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
        data-testid="genai-hi-results-error"
      >
        <p className="text-sm font-medium text-[#475467]">Could not load your GenAI Human Interview results.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#eaecf0] bg-white px-3 py-1.5 text-sm font-bold text-[#344054] hover:bg-[#f9fafb]"
          data-testid="button-retry-genai-hi-results"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Retry
        </button>
      </section>
    );
  }

  if (!data || !data.released || data.attempts.length === 0) return null;

  const latest = data.latestResult;
  const latestStatus = latest ? normStatus(latest.clearanceStatus) : "pending";

  return (
    <section
      id={GENAI_HUMAN_INTERVIEW_SECTION_ID}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#eaecf0] border-t-[3px] border-t-[#175cd3] bg-white p-5 sm:p-6"
      data-testid="card-genai-hi-results"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eff8ff] px-2.5 py-1 text-[11px] font-bold text-[#175cd3]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#175cd3]" />
            GenAI Track
          </span>
          <h2 className="mt-3 font-display text-xl font-extrabold text-[#101828]">Human Interview Results</h2>
        </div>
        {data.syncedAt ? (
          <p className="text-xs text-[#667085]" data-testid="text-genai-hi-synced">
            Updated {new Date(data.syncedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        ) : null}
      </div>

      <div
        className={`mt-4 rounded-xl border px-4 py-3.5 ${
          latestStatus === "cleared"
            ? "border-[#abefc6] bg-[#ecfdf3]"
            : latestStatus === "not_cleared"
              ? "border-[#fecdca] bg-[#fef3f2]"
              : "border-[#eaecf0] bg-[#f9fafb]"
        }`}
        data-testid="status-genai-hi-latest"
      >
        {latest ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#475467]">
                Current status (latest scored interview, {fmtDate(latest.interviewDate)})
              </p>
              <p className="mt-0.5 font-display text-xl font-extrabold text-[#101828]">
                {latestStatus === "cleared" ? "Cleared" : latestStatus === "not_cleared" ? "Not Cleared" : latest.clearanceStatus}
              </p>
            </div>
            <p className="text-sm font-semibold text-[#344054]">
              Overall <span className="font-mono text-base text-[#101828]">{fmtFinal(latest.finalScore)}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm font-semibold text-[#344054]">
            No scored interview yet. Your status will appear once an interview is completed and scored.
          </p>
        )}
      </div>

      <p className="mt-5 text-xs font-semibold text-[#475467]">
        Last 3 attempts, newest first ({data.attempts.length} total)
      </p>
      <ul className="mt-2 space-y-2.5">
        {data.attempts.slice(0, 3).map((a, i) => {
          const marked = !!latest && a.interviewId === latest.interviewId;
          return (
            <li
              key={`${a.interviewId}-${i}`}
              className={`rounded-xl border px-4 py-3 ${marked ? "border-[#b2ddff] bg-[#f5faff]" : "border-[#eaecf0] bg-white"}`}
              data-testid={`row-genai-hi-attempt-${i}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#101828]">{fmtDate(a.interviewDate)}</span>
                  {a.interviewStartTime ? <span className="text-xs text-[#667085]">{a.interviewStartTime}</span> : null}
                  {marked ? (
                    <span className="rounded-full bg-[#175cd3] px-2 py-0.5 text-[11px] font-bold text-white">Latest result</span>
                  ) : null}
                </div>
                <StatusChip status={a.clearanceStatus} />
              </div>
              {hasScores(a) ? (
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    {SECTIONS.map((s) => (
                      <div key={s.rating} className="rounded-lg border border-[#eaecf0] bg-white px-3 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-xs font-semibold leading-snug text-[#101828]">
                            {s.title} <span className="font-normal text-[#667085]">· {s.weight}</span>
                          </dt>
                          <dd className="shrink-0 font-mono text-sm text-[#344054]">{fmtRating(a[s.rating])}</dd>
                        </div>
                        {a[s.remarks] ? (
                          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-[#475467]">{a[s.remarks]}</p>
                        ) : null}
                      </div>
                    ))}
                  </dl>
              ) : (
                <p className="mt-1.5 text-xs text-[#667085]">
                  {a.clearanceStatus.trim()
                    ? "This interview was not completed, so no scores are recorded."
                    : "Your interview result is pending."}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
