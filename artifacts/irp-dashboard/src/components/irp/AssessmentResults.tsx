import { ClipboardCheck, Lock } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase, LEVEL_META } from "@/lib/journey";
import { areAssignmentResultsVisible } from "@/lib/irpDates";
import { ProgressRing, Pill } from "./ui";

function resultTone(pct: number): "green" | "purple" | "grey" {
  if (pct >= 60) return "green";
  if (pct >= 40) return "purple";
  return "grey";
}

function resultLabel(pct: number) {
  if (pct >= 75) return "Strong";
  if (pct >= 60) return "Cleared";
  if (pct >= 40) return "Borderline";
  return "Needs work";
}

function parseAssessmentLevel(level: string | null | undefined): number | null {
  if (!level?.trim()) return null;
  const match = /^L?(\d)/i.exec(level.trim());
  return match ? Number(match[1]) : null;
}

function pickAssessment(
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
): AssessmentResult | null {
  const forLevel = assessments.filter((a) => parseAssessmentLevel(a.level) === level);
  if (forLevel.length > 0) return forLevel[0];
  return assessments[0] ?? null;
}

export function AssessmentResults({
  journey,
  examDateLabel,
  assessments,
}: {
  journey: Journey;
  examDateLabel: string;
  assessments: AssessmentResult[];
}) {
  const level = getLevel(journey.journeyState);
  const phase = getPhase(journey.journeyState);
  const meta = LEVEL_META[level];
  const unlocked =
    areAssignmentResultsVisible() ||
    phase === "POST_ASSESSMENT" ||
    phase === "PLACED";
  const assessment = pickAssessment(assessments, level);
  const hasResults = unlocked && assessment != null;

  return (
    <div className="irp-card p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-extrabold">
            <ClipboardCheck className="h-4 w-4 text-brand-2" />
            <span className="text-gradient-brand">Assessment Results</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted2">
            {assessment?.assessmentTitle ?? `${meta.name} online assessment`} · {examDateLabel}
          </p>
        </div>
        {hasResults && (
          <Pill tone={resultTone(assessment.overallPct)}>{resultLabel(assessment.overallPct)}</Pill>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        <ScoreCard
          label="Overall"
          tone="purple"
          title="Total score"
          value={hasResults ? `${Math.round(assessment.overallScore)}` : "—"}
          suffix={hasResults ? `/${Math.round(assessment.overallMax)}` : ""}
          sub={hasResults ? "Combined MCQs & coding" : "Unlocks after assessment"}
          pct={hasResults ? assessment.overallPct : 0}
          locked={!hasResults}
        />
        <ScoreCard
          label="MCQs"
          tone="blue"
          title="MCQ score"
          value={hasResults ? `${Math.round(assessment.mcqScore)}` : "—"}
          suffix={hasResults ? `/${Math.round(assessment.mcqMax)}` : ""}
          sub={hasResults ? `${assessment.mcqPct}% correct` : "Unlocks after assessment"}
          pct={hasResults ? assessment.mcqPct : 0}
          locked={!hasResults}
        />
        <ScoreCard
          label="Coding"
          tone="green"
          title="Coding score"
          value={hasResults ? `${Math.round(assessment.codingScore)}` : "—"}
          suffix={hasResults ? `/${Math.round(assessment.codingMax)}` : ""}
          sub={hasResults ? `${assessment.codingPct}% solved` : "Unlocks after assessment"}
          pct={hasResults ? assessment.codingPct : 0}
          locked={!hasResults}
        />
      </div>

      {hasResults ? (
        <div className="overflow-hidden rounded-2xl border border-[rgba(103,65,217,0.08)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[rgba(103,65,217,0.08)] bg-[rgba(248,247,255,0.9)]">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted2">Section</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-l1">Score</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-teal">Percentage</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[rgba(103,65,217,0.06)]">
                <td className="px-4 py-3 font-semibold text-ink">MCQs</td>
                <td className="px-4 py-3 text-muted2">
                  {Math.round(assessment.mcqScore)}/{Math.round(assessment.mcqMax)}
                </td>
                <td className="px-4 py-3 text-muted2">{assessment.mcqPct}%</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Coding</td>
                <td className="px-4 py-3 text-muted2">
                  {Math.round(assessment.codingScore)}/{Math.round(assessment.codingMax)}
                </td>
                <td className="px-4 py-3 text-muted2">{assessment.codingPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-[rgba(103,65,217,0.1)] bg-[rgba(248,247,255,0.8)] px-4 py-3">
          <Lock className="h-4 w-4 shrink-0 text-muted2" />
          <p className="text-xs font-medium text-muted2">
            {unlocked && assessments.length === 0
              ? "Your assessment results are syncing. Check back shortly."
              : (
                <>
                  Marks unlock after your assessment on{" "}
                  <span className="font-bold text-ink">{examDateLabel}</span>.
                </>
              )}
          </p>
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  tone,
  title,
  value,
  suffix,
  sub,
  pct,
  locked,
}: {
  label: string;
  tone: "purple" | "blue" | "green";
  title: string;
  value: string;
  suffix: string;
  sub: string;
  pct: number;
  locked: boolean;
}) {
  const topBorder = tone === "green" ? "border-t-teal" : "border-t-l1";

  return (
    <div
      className={`hover-lift relative flex h-full items-center gap-4 rounded-2xl border border-[rgba(103,65,217,0.1)] border-t-[3px] ${topBorder} bg-white p-4 shadow-soft ${
        locked ? "opacity-90" : ""
      }`}
    >
      <ProgressRing value={pct} tone={tone} label={label} locked={locked} />

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted2">{title}</p>
        <p className="font-display text-2xl font-black leading-none text-ink">
          {value}
          {suffix && <span className="text-base font-semibold text-dim">{suffix}</span>}
        </p>
        <p className={`mt-1 text-xs font-semibold ${locked ? "text-muted2" : "text-l2-text"}`}>{sub}</p>
      </div>
    </div>
  );
}
