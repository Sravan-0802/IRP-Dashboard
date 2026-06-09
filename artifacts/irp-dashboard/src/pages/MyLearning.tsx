import { TRACKS } from "@/lib/courses";
import { IrpCard, ProgressRing } from "@/components/irp/ui";
import { SubjectBreakdown, type SubjectRow } from "@/components/irp/ProgressSummary";

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

function subjectsDone(subjects: SubjectRow[]): number {
  return subjects.filter(
    (s) => s.mcqPercentage >= 100 && s.codingPercentage >= 100,
  ).length;
}

export function MyLearning({ subjects }: { subjects: SubjectRow[] }) {
  const mcqDone = subjects.reduce((a, s) => a + s.mcqCompleted, 0);
  const mcqTotal = subjects.reduce((a, s) => a + s.mcqTotal, 0);
  const codeDone = subjects.reduce((a, s) => a + s.codingCompleted, 0);
  const codeTotal = subjects.reduce((a, s) => a + s.codingTotal, 0);
  const overallDone = mcqDone + codeDone;
  const overallTotal = mcqTotal + codeTotal;

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
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Practice Hub</h1>
        <p className="mt-1 text-sm text-muted2">Track your courses, subjects and practice progress.</p>
      </div>

      {/* Summary stat cards — unchanged */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Overall completion" done={overallDone} total={overallTotal} tone="overall" />
        <StatCard label="MCQs done" done={mcqDone} total={mcqTotal} tone="mcq" />
        <StatCard label="Problems solved" done={codeDone} total={codeTotal} tone="code" />
      </div>

      {/* ── Section 1: Course Progress ── */}
      <IrpCard className="p-5 sm:p-6">
        <p className="section-label mb-4 text-brand">Course Progress</p>
        <div className="space-y-3">
          {TRACKS.map((track) => {
            const tSubjects = subjectsForTrack(track.courses);
            const pct = trackPct(tSubjects);
            const done = subjectsDone(tSubjects);
            const tone = pct === 100 ? "green" : "purple";
            const doneColor = pct === 100 ? "#0ca678" : "#3b5bdb";

            return (
              <div
                key={track.name}
                className="flex items-center gap-4 rounded-2xl border border-[rgba(103,65,217,0.1)] bg-white p-4 shadow-soft transition-colors hover:border-[rgba(103,65,217,0.22)]"
              >
                {/* Ring */}
                <div className="shrink-0">
                  <ProgressRing value={pct} size={54} tone={tone} />
                </div>

                {/* Middle: name + level + pills */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="font-display text-sm font-extrabold text-ink">
                      {track.emoji} {track.name}
                    </p>
                    <span className="shrink-0 text-[10px] font-semibold text-muted2">
                      L{track.level}
                    </span>
                  </div>
                  <p className="text-[10px] text-dim">{track.courses.length} courses</p>
                  {/* Horizontal scrollable pills — no wrap */}
                  <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {track.courses.map((c) => (
                      <span
                        key={c}
                        className="shrink-0 rounded-md border border-[#dee2e6] bg-[#f1f3f5] px-2 py-1 text-[10px] font-medium text-muted2"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: done counter */}
                <div className="shrink-0 text-right">
                  <p className="font-display text-base font-black leading-none" style={{ color: doneColor }}>
                    {done}
                    <span className="text-xs font-semibold text-dim">/{tSubjects.length}</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-dim">subjects done</p>
                </div>
              </div>
            );
          })}
        </div>
      </IrpCard>

      {/* ── Section 2: Subject-wise Stats ── */}
      <SubjectBreakdown subjects={subjects} />
    </div>
  );
}
