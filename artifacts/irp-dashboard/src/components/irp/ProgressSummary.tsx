import { TrendingUp, ArrowRight } from "lucide-react";
import { ProgressRing } from "./ui";

export interface SubjectRow {
  subject: string;
  mcqCompleted: number;
  mcqTotal: number;
  codingCompleted: number;
  codingTotal: number;
  mcqPercentage: number;
  codingPercentage: number;
}

export function ProgressSummary({
  overallPct,
  mcqPct,
  codingPct,
  mcqDone,
  mcqTotal,
  codingDone,
  codingTotal,
  points,
  maxPoints,
}: {
  overallPct: number;
  mcqPct: number;
  codingPct: number;
  mcqDone: number;
  mcqTotal: number;
  codingDone: number;
  codingTotal: number;
  points: number;
  maxPoints: number;
}) {
  const momentum =
    overallPct >= 75
      ? "🔥 On fire"
      : overallPct >= 50
        ? "⚡ In the zone"
        : overallPct >= 25
          ? "📈 Building momentum"
          : "🚀 Just getting started";
  return (
    <div className="irp-card p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-ink">
            <TrendingUp className="h-4 w-4 text-brand" /> Overall IRP Progress
          </h3>
          <p className="mt-0.5 text-xs text-muted2">MCQs &amp; Coding practice combined</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-muted2">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-l1" />MCQs</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-teal" />Coding</span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        {/* Overall — blue→purple */}
        <div className="hover-lift flex h-full items-center gap-4 rounded-2xl border border-[rgba(103,65,217,0.1)] border-t-[3px] border-t-l1 bg-white p-4 shadow-soft">
          <ProgressRing value={overallPct} tone="purple" label="Overall" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted2">Total points</p>
            <p className="font-display text-2xl font-black leading-none text-ink">
              {points.toLocaleString()}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted2">
              of {maxPoints.toLocaleString()} pts
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[rgba(59,91,219,0.18)] bg-l1-bg px-2 py-1 text-[10px] font-bold text-l1">
              {momentum}
            </span>
          </div>
        </div>

        {/* MCQs — blue */}
        <div className="hover-lift flex h-full items-center gap-4 rounded-2xl border border-[rgba(103,65,217,0.1)] border-t-[3px] border-t-l1 bg-white p-4 shadow-soft">
          <ProgressRing value={mcqPct} tone="blue" label="MCQs" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted2">Questions done</p>
            <p className="font-display text-2xl font-black leading-none text-ink">
              {mcqDone}
              <span className="text-base font-semibold text-dim">/{mcqTotal}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-l2-text">
              {Math.max(0, mcqTotal - mcqDone)} remaining
            </p>
            <button className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[rgba(59,91,219,0.18)] bg-l1-bg px-2 py-1 text-[10px] font-bold text-l1 transition-colors hover:bg-l1 hover:text-white">
              Continue <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Coding — teal */}
        <div className="hover-lift flex h-full items-center gap-4 rounded-2xl border border-[rgba(103,65,217,0.1)] border-t-[3px] border-t-teal bg-white p-4 shadow-soft">
          <ProgressRing value={codingPct} tone="green" label="Coding" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted2">Problems solved</p>
            <p className="font-display text-2xl font-black leading-none text-ink">
              {codingDone}
              <span className="text-base font-semibold text-dim">/{codingTotal}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-l2-text">
              {Math.max(0, codingTotal - codingDone)} remaining
            </p>
            <button className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[rgba(12,166,120,0.25)] bg-[#e8faf0] px-2 py-1 text-[10px] font-bold text-teal transition-colors hover:bg-teal hover:text-white">
              Continue <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubjectBreakdown({ subjects }: { subjects: SubjectRow[] }) {
  return (
    <div className="irp-card p-5 sm:p-6">
      <p className="section-label mb-4 text-brand">Subject-wise Stats</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((sub) => (
          <div key={sub.subject} className="rounded-2xl border border-[rgba(103,65,217,0.07)] bg-white p-4 shadow-soft">
            <p className="mb-3 truncate text-sm font-bold text-ink">{sub.subject}</p>
            <Bar tone="blue" label="MCQ" done={sub.mcqCompleted} total={sub.mcqTotal} pct={sub.mcqPercentage} />
            <div className="h-2.5" />
            <Bar tone="green" label="Code" done={sub.codingCompleted} total={sub.codingTotal} pct={sub.codingPercentage} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({
  tone,
  label,
  done,
  total,
  pct,
}: {
  tone: "blue" | "green";
  label: string;
  done: number;
  total: number;
  pct: number;
}) {
  const color = tone === "blue" ? "#3b5bdb" : "#0ca678";
  const fill = tone === "blue" ? "linear-gradient(90deg,#3b82f6,#3b5bdb)" : "linear-gradient(90deg,#0ca678,#2f9e44)";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-9 shrink-0 text-[11px] font-bold" style={{ color }}>{label}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgba(103,65,217,0.08)]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <span className="w-12 shrink-0 text-right text-[11px] font-semibold text-muted2">{done}/{total}</span>
      <span className="w-9 shrink-0 text-right text-[11px] font-bold" style={{ color }}>{pct}%</span>
    </div>
  );
}
