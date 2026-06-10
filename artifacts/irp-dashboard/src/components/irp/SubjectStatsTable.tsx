import { useMemo } from "react";
import { buildSubjectStatsRows } from "@/lib/subjectMatching";
import type { SubjectRow } from "./ProgressSummary";
import { IrpCard } from "./ui";

const TRACK_COLORS: Record<string, { bg: string; text: string }> = {
  "Frontend Track": { bg: "rgba(59,91,219,0.1)", text: "#3b5bdb" },
  "Coding Track": { bg: "rgba(103,65,217,0.1)", text: "#6741d9" },
  "Backend Track": { bg: "rgba(245,159,0,0.12)", text: "#d17c00" },
  "Generative AI Track": { bg: "rgba(230,73,128,0.1)", text: "#c2255c" },
  "DSA Track": { bg: "rgba(12,166,120,0.1)", text: "#0ca678" },
  "Practice Platforms": { bg: "rgba(12,166,120,0.1)", text: "#0ca678" },
};

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
      <span className="w-8 text-right text-[11px] font-bold" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export function SubjectStatsTable({
  subjects,
  level = 1,
}: {
  subjects: SubjectRow[];
  level?: 1 | 2 | 3;
}) {
  const tableRows = useMemo(
    () => buildSubjectStatsRows(subjects, level),
    [subjects, level],
  );

  if (tableRows.length === 0) return null;

  return (
    <IrpCard className="p-5 sm:p-6">
      <p className="section-label mb-4 text-brand">Subject-wise Stats</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[rgba(103,65,217,0.08)]">
              <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted2">
                Subject
              </th>
              <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted2">
                Track
              </th>
              <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted2">
                MCQ
              </th>
              <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted2">
                Code
              </th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(({ course, trackName, data }, i) => {
              const tc = TRACK_COLORS[trackName] ?? { bg: "rgba(103,65,217,0.1)", text: "#6741d9" };
              const shortTrack = trackName.replace(" Track", "").replace(" Platforms", "");
              return (
                <tr
                  key={course}
                  className={`border-b border-[rgba(103,65,217,0.05)] ${i % 2 === 1 ? "bg-[#fafafa]" : "bg-white"}`}
                >
                  <td className="py-2.5 pr-4 text-xs font-semibold text-ink">{course}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: tc.bg, color: tc.text }}
                    >
                      {shortTrack}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <Bar pct={data?.mcqPercentage ?? 0} tone="blue" />
                  </td>
                  <td className="py-2.5">
                    <Bar pct={data?.codingPercentage ?? 0} tone="green" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </IrpCard>
  );
}
