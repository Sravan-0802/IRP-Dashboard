import { TrendingUp, ArrowRight } from "lucide-react";
import { ProgressRing, IrpCard } from "./ui";

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
  subjects,
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
  subjects: SubjectRow[];
}) {
  return (
    <IrpCard className="p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-[#e8e6ff]">
            <TrendingUp className="h-4 w-4 text-[#8a6eff]" /> Overall IRP Progress
          </h3>
          <p className="mt-0.5 text-xs text-[#7a6eaa]">MCQs &amp; Coding practice combined</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-[#7a6eaa]">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#5b8cff]" />MCQs</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#46d39b]" />Coding</span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        {/* Overall — gold */}
        <div className="flex h-full items-center gap-4 rounded-2xl border border-[#ffc83d]/25 bg-[#ffc83d]/[0.07] p-4">
          <ProgressRing value={overallPct} tone="gold" label="Overall" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#a99fce]">Total points</p>
            <p className="font-display text-2xl font-black leading-none">
              <span className="irp-gold-text">{points.toLocaleString()}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-[#7a6eaa]">
              of {maxPoints.toLocaleString()} pts
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[#ffc83d]/30 bg-[#ffc83d]/10 px-2 py-1 text-[10px] font-bold text-[#ffd870]">
              🏅 You're doing great
            </span>
          </div>
        </div>

        {/* MCQs — blue */}
        <div className="flex h-full items-center gap-4 rounded-2xl border border-[#5b8cff]/20 bg-[#5b8cff]/[0.08] p-4">
          <ProgressRing value={mcqPct} tone="blue" label="MCQs" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#a99fce]">Questions done</p>
            <p className="font-display text-2xl font-black leading-none text-[#e8e6ff]">
              {mcqDone}
              <span className="text-base font-semibold text-[#6a6092]">/{mcqTotal}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-[#ffc564]">
              {Math.max(0, mcqTotal - mcqDone)} remaining
            </p>
            <button className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[#5b8cff]/30 bg-[#5b8cff]/10 px-2 py-1 text-[10px] font-bold text-[#9cc0ff] transition-colors hover:bg-[#5b8cff]/20">
              Continue <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Coding — green */}
        <div className="flex h-full items-center gap-4 rounded-2xl border border-[#1d9e75]/20 bg-[#1d9e75]/[0.08] p-4">
          <ProgressRing value={codingPct} tone="green" label="Coding" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#a99fce]">Problems solved</p>
            <p className="font-display text-2xl font-black leading-none text-[#e8e6ff]">
              {codingDone}
              <span className="text-base font-semibold text-[#6a6092]">/{codingTotal}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-[#ffc564]">
              {Math.max(0, codingTotal - codingDone)} remaining
            </p>
            <button className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[#1d9e75]/30 bg-[#1d9e75]/10 px-2 py-1 text-[10px] font-bold text-[#5fe0ad] transition-colors hover:bg-[#1d9e75]/20">
              Continue <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="-mx-1 mt-2 rounded-2xl border border-white/5 bg-black/20 px-4 py-5">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#7a6eaa]">
          Subject-wise breakdown
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((sub) => (
            <div key={sub.subject} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <p className="mb-3 truncate text-sm font-bold text-[#e8e6ff]">{sub.subject}</p>
              <Bar tone="blue" label="MCQ" done={sub.mcqCompleted} total={sub.mcqTotal} pct={sub.mcqPercentage} />
              <div className="h-2.5" />
              <Bar tone="green" label="Code" done={sub.codingCompleted} total={sub.codingTotal} pct={sub.codingPercentage} />
            </div>
          ))}
        </div>
      </div>
    </IrpCard>
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
  const color = tone === "blue" ? "#5b8cff" : "#46d39b";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-9 shrink-0 text-[11px] font-bold" style={{ color }}>{label}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-12 shrink-0 text-right text-[11px] font-semibold text-[#a99fce]">{done}/{total}</span>
      <span className="w-9 shrink-0 text-right text-[11px] font-bold" style={{ color }}>{pct}%</span>
    </div>
  );
}
