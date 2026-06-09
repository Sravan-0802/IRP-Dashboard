import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TRACKS } from "@/lib/courses";
import { IrpCard, ProgressRing } from "@/components/irp/ui";
import type { SubjectRow } from "@/components/irp/ProgressSummary";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  done,
  total,
  tone,
}: {
  label: string;
  done: number;
  total: number;
  tone: "overall" | "mcq" | "code";
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const color = tone === "code" ? "#0ca678" : "#3b5bdb";
  const grad =
    tone === "code"
      ? "linear-gradient(90deg,#0ca678,#2f9e44)"
      : "linear-gradient(90deg,#3b82f6,#3b5bdb)";
  return (
    <div className="rounded-2xl border border-[rgba(103,65,217,0.08)] bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted2">{label}</p>
        <span className="font-display text-sm font-extrabold" style={{ color }}>{pct}%</span>
      </div>
      <p className="mt-2 font-display text-2xl font-black" style={{ color }}>
        {done}
        <span className="text-base font-medium text-dim">/{total}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(103,65,217,0.08)]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: grad }} />
      </div>
    </div>
  );
}

function trackPct(subjects: SubjectRow[]): number {
  if (subjects.length === 0) return 0;
  const total = subjects.reduce((a, s) => a + s.mcqTotal + s.codingTotal, 0);
  const done = subjects.reduce((a, s) => a + s.mcqCompleted + s.codingCompleted, 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function MyLearning({ subjects }: { subjects: SubjectRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const mcqDone = subjects.reduce((a, s) => a + s.mcqCompleted, 0);
  const mcqTotal = subjects.reduce((a, s) => a + s.mcqTotal, 0);
  const codeDone = subjects.reduce((a, s) => a + s.codingCompleted, 0);
  const codeTotal = subjects.reduce((a, s) => a + s.codingTotal, 0);
  const overallDone = mcqDone + codeDone;
  const overallTotal = mcqTotal + codeTotal;

  // Map each track to a slice of subject rows (best-effort by name match; falls back to all).
  function subjectsForTrack(courses: string[]): SubjectRow[] {
    const matched = subjects.filter((s) =>
      courses.some(
        (c) =>
          c.toLowerCase().includes(s.subject.toLowerCase()) ||
          s.subject.toLowerCase().includes(c.toLowerCase().split(" ")[0]),
      ),
    );
    return matched.length > 0 ? matched : subjects;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">My Learning</h1>
        <p className="mt-1 text-sm text-muted2">Track your courses, subjects and practice progress.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Overall completion" done={overallDone} total={overallTotal} tone="overall" />
        <StatCard label="MCQs done" done={mcqDone} total={mcqTotal} tone="mcq" />
        <StatCard label="Problems solved" done={codeDone} total={codeTotal} tone="code" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {TRACKS.map((track) => {
          const tSubjects = subjectsForTrack(track.courses);
          const pct = trackPct(tSubjects);
          const tone = pct === 100 ? "green" : "purple";
          const isOpen = expanded === track.name;
          return (
            <IrpCard key={track.name} className="p-5">
              <div className="flex items-start gap-4">
                <ProgressRing value={pct} size={68} tone={tone} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-extrabold text-ink">
                    {track.emoji} {track.name}
                  </p>
                  <p className="text-xs text-muted2">
                    Level {track.level} · {track.courses.length} courses
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {track.courses.map((c) => (
                      <span
                        key={c}
                        className="rounded-md border border-[#dee2e6] bg-[#f1f3f5] px-2 py-1 text-[10px] font-medium text-muted2"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : track.name)}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border-t border-[rgba(103,65,217,0.07)] bg-[rgba(103,65,217,0.03)] py-2 text-xs font-semibold text-muted2 transition-colors hover:bg-[rgba(103,65,217,0.05)] hover:text-brand"
              >
                Subject-wise stats
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
              </button>

              {isOpen && (
                <div className="mt-3 space-y-3 rounded-xl border border-[rgba(103,65,217,0.06)] bg-[rgba(248,247,255,0.8)] p-3">
                  {tSubjects.map((s) => (
                    <div key={s.subject} className="rounded-lg border border-[rgba(103,65,217,0.07)] bg-white p-2.5">
                      <p className="mb-1.5 text-xs font-semibold text-ink">{s.subject}</p>
                      <MiniBar tone="blue" label="MCQ" pct={s.mcqPercentage} />
                      <div className="h-1.5" />
                      <MiniBar tone="green" label="Code" pct={s.codingPercentage} />
                    </div>
                  ))}
                </div>
              )}
            </IrpCard>
          );
        })}
      </div>
    </div>
  );
}

function MiniBar({ tone, label, pct }: { tone: "blue" | "green"; label: string; pct: number }) {
  const color = tone === "blue" ? "#3b5bdb" : "#0ca678";
  const fill = tone === "blue" ? "linear-gradient(90deg,#3b82f6,#3b5bdb)" : "linear-gradient(90deg,#0ca678,#2f9e44)";
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[10px] font-bold" style={{ color }}>{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(103,65,217,0.08)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <span className="w-9 text-right text-[10px] font-bold" style={{ color }}>{pct}%</span>
    </div>
  );
}
