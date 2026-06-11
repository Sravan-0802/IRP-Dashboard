import { Lock } from "lucide-react";
import { TRACKS } from "@/lib/courses";
import { subjectsForTrack } from "@/lib/subjectMatching";
import { IrpCard, ProgressRing } from "@/components/irp/ui";
import { SubjectStatsTable } from "@/components/irp/SubjectStatsTable";
import type { SubjectRow } from "@/components/irp/ProgressSummary";
import { isProgressVisible, PROGRESS_UNLOCK_LABEL } from "@/lib/irpDates";

function StatCard({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: "overall" | "mcq" | "code";
}) {
  const color = tone === "code" ? "#0ca678" : "#3b5bdb";
  const grad =
    tone === "code"
      ? "linear-gradient(90deg,#0ca678,#2f9e44)"
      : "linear-gradient(90deg,#3b82f6,#3b5bdb)";
  return (
    <div className="rounded-2xl border border-[rgba(103,65,217,0.08)] bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted2">{label}</p>
      </div>
      <p className="mt-2 font-display text-3xl font-black" style={{ color }}>
        {pct}%
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(103,65,217,0.08)]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: grad }} />
      </div>
    </div>
  );
}

function trackPct(subjects: SubjectRow[], courses: string[]): number {
  const matched = subjectsForTrack(courses, subjects);
  if (matched.length === 0) return 0;
  const total = matched.reduce((a, s) => a + s.mcqTotal + s.codingTotal, 0);
  const done = matched.reduce((a, s) => a + s.mcqCompleted + s.codingCompleted, 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function MyLearning({ subjects, level = 1 }: { subjects: SubjectRow[]; level?: 1 | 2 | 3 }) {
  if (!isProgressVisible()) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Practice Hub</h1>
          <p className="mt-1 text-sm text-muted2">Track your courses, subjects and practice progress.</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[rgba(103,65,217,0.1)] bg-[rgba(103,65,217,0.03)] py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-l1-bg text-l1">
            <Lock className="h-7 w-7" />
          </div>
          <div>
            <p className="font-display text-xl font-extrabold text-ink">Progress data is being prepared</p>
            <p className="mt-2 max-w-sm text-sm text-muted2">
              Your course progress, MCQ stats, and coding scores will be visible here from{" "}
              <span className="font-bold text-l1">{PROGRESS_UNLOCK_LABEL}</span>. Keep practising!
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(59,91,219,0.2)] bg-l1-bg px-4 py-1.5 text-sm font-bold text-l1">
            🔒 Unlocks {PROGRESS_UNLOCK_LABEL}
          </span>
        </div>
      </div>
    );
  }

  const mcqDone = subjects.reduce((a, s) => a + s.mcqCompleted, 0);
  const mcqTotal = subjects.reduce((a, s) => a + s.mcqTotal, 0);
  const codeDone = subjects.reduce((a, s) => a + s.codingCompleted, 0);
  const codeTotal = subjects.reduce((a, s) => a + s.codingTotal, 0);
  const overallDone = mcqDone + codeDone;
  const overallTotal = mcqTotal + codeTotal;
  const overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;
  const mcqPct = mcqTotal > 0 ? Math.round((mcqDone / mcqTotal) * 100) : 0;
  const codePct = codeTotal > 0 ? Math.round((codeDone / codeTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Practice Hub</h1>
        <p className="mt-1 text-sm text-muted2">Track your courses, subjects and practice progress.</p>
      </div>

      {/* Summary stat cards — percentages only */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Overall completion" pct={overallPct} tone="overall" />
        <StatCard label="MCQs completed" pct={mcqPct} tone="mcq" />
        <StatCard label="Problems solved" pct={codePct} tone="code" />
      </div>

      {/* ── Section 1: Course Progress — current level only, 2-column grid ── */}
      <div>
        <p className="section-label mb-3 text-brand">Course Progress</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {TRACKS.filter((t) => t.level === level).map((track) => {
            const pct = trackPct(subjects, track.courses);
            const tone = pct === 100 ? "green" : "purple";
            return (
              <IrpCard key={track.name} className="p-5">
                <div className="flex items-center gap-4">
                  <ProgressRing value={pct} size={54} tone={tone} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-extrabold text-ink">
                      {track.emoji} {track.name}
                    </p>
                    <p className="text-xs text-muted2">
                      Level {track.level} · {track.courses.length} courses
                    </p>
                  </div>
                </div>
              </IrpCard>
            );
          })}
        </div>
      </div>

      <SubjectStatsTable subjects={subjects} level={level} />

      <p
        className="text-left italic"
        style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: "11px",
          color: "#aaa5c0",
          marginTop: "8px",
          marginBottom: "0",
        }}
      >
        Course progress shown here reflects your completion of courses in the NxtWave Academy Course
        Library. This is separate from your Growth Cycle progress tracked in My Journey.
      </p>
    </div>
  );
}
