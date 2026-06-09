import { TRACKS } from "@/lib/courses";
import { IrpCard, ProgressRing } from "@/components/irp/ui";
import type { SubjectRow } from "@/components/irp/ProgressSummary";

const TRACK_COLORS: Record<string, { bg: string; text: string }> = {
  "Frontend Track":      { bg: "rgba(59,91,219,0.1)",   text: "#3b5bdb" },
  "Coding Track":        { bg: "rgba(103,65,217,0.1)",  text: "#6741d9" },
  "Backend Track":       { bg: "rgba(245,159,0,0.12)",  text: "#d17c00" },
  "Generative AI Track": { bg: "rgba(230,73,128,0.1)",  text: "#c2255c" },
  "DSA Track":           { bg: "rgba(12,166,120,0.1)",  text: "#0ca678" },
  "Practice Platforms":  { bg: "rgba(12,166,120,0.1)",  text: "#0ca678" },
};

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

function trackPct(subjects: SubjectRow[]): number {
  if (subjects.length === 0) return 0;
  const total = subjects.reduce((a, s) => a + s.mcqTotal + s.codingTotal, 0);
  const done = subjects.reduce((a, s) => a + s.mcqCompleted + s.codingCompleted, 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function Bar({ pct, tone }: { pct: number; tone: "blue" | "green" }) {
  const color = tone === "blue" ? "#3b5bdb" : "#0ca678";
  const fill =
    tone === "blue"
      ? "linear-gradient(90deg,#3b82f6,#3b5bdb)"
      : "linear-gradient(90deg,#0ca678,#2f9e44)";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[rgba(103,65,217,0.08)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <span className="w-8 text-right text-[11px] font-bold" style={{ color }}>{pct}%</span>
    </div>
  );
}

export function MyLearning({ subjects, level = 1 }: { subjects: SubjectRow[]; level?: 1 | 2 | 3 }) {
  const mcqDone = subjects.reduce((a, s) => a + s.mcqCompleted, 0);
  const mcqTotal = subjects.reduce((a, s) => a + s.mcqTotal, 0);
  const codeDone = subjects.reduce((a, s) => a + s.codingCompleted, 0);
  const codeTotal = subjects.reduce((a, s) => a + s.codingTotal, 0);
  const overallDone = mcqDone + codeDone;
  const overallTotal = mcqTotal + codeTotal;
  const overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;
  const mcqPct = mcqTotal > 0 ? Math.round((mcqDone / mcqTotal) * 100) : 0;
  const codePct = codeTotal > 0 ? Math.round((codeDone / codeTotal) * 100) : 0;

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

  // Build subject → track name mapping for the table
  const subjectTrackMap = new Map<string, string>();
  for (const track of TRACKS) {
    const tSubjects = subjectsForTrack(track.courses);
    for (const s of tSubjects) {
      if (!subjectTrackMap.has(s.subject)) {
        subjectTrackMap.set(s.subject, track.name);
      }
    }
  }

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
            const tSubjects = subjectsForTrack(track.courses);
            const pct = trackPct(tSubjects);
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

      {/* ── Section 2: Subject-wise Stats — compact table ── */}
      <IrpCard className="p-5 sm:p-6">
        <p className="section-label mb-4 text-brand">Subject-wise Stats</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[rgba(103,65,217,0.08)]">
                <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted2">Subject</th>
                <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted2">Track</th>
                <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted2">MCQ</th>
                <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted2">Code</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub, i) => {
                const trackName = subjectTrackMap.get(sub.subject) ?? "—";
                const tc = TRACK_COLORS[trackName] ?? { bg: "rgba(103,65,217,0.1)", text: "#6741d9" };
                return (
                  <tr
                    key={sub.subject}
                    className={`border-b border-[rgba(103,65,217,0.05)] ${i % 2 === 1 ? "bg-[#fafafa]" : "bg-white"}`}
                  >
                    <td className="py-2.5 pr-4 text-xs font-semibold text-ink">{sub.subject}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: tc.bg, color: tc.text }}
                      >
                        {trackName.replace(" Track", "").replace(" Platforms", "")}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Bar pct={sub.mcqPercentage} tone="blue" />
                    </td>
                    <td className="py-2.5">
                      <Bar pct={sub.codingPercentage} tone="green" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </IrpCard>
    </div>
  );
}
