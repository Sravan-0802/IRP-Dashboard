import { ClipboardCheck, Lock } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase, LEVEL_META } from "@/lib/journey";
import { areAssignmentResultsVisible } from "@/lib/irpDates";
import {
  assessmentOverallPct,
  hasWrittenAssessment,
  isAssessmentResultsLocked,
  pickAssessmentForLevel,
  resultLabel,
  resultTone,
} from "@/lib/assessment";
import { ProgressRing, Pill } from "./ui";

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
  const resultsUnlockedByDate =
    areAssignmentResultsVisible() ||
    phase === "POST_ASSESSMENT" ||
    phase === "PLACED";
  const assessment = pickAssessmentForLevel(assessments, level);
  const locked = isAssessmentResultsLocked(assessments, level, resultsUnlockedByDate);
  const showResults = !locked;
  const overallPct = assessment ? assessmentOverallPct(assessment) : 0;

  const lockedMessage = (() => {
    if (!resultsUnlockedByDate) {
      return (
        <>
          Marks unlock after your assessment on{" "}
          <span className="font-bold text-ink">{examDateLabel}</span>.
        </>
      );
    }
    if (!hasWrittenAssessment(assessments, level)) {
      return <>Complete your online assessment to unlock your results.</>;
    }
    return "Your assessment results are syncing. Check back shortly.";
  })();

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
        {showResults && assessment && (
          <Pill tone={resultTone(overallPct)}>{resultLabel(overallPct)}</Pill>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        <ScoreCard
          label="Overall"
          tone="purple"
          title="Total score"
          value={showResults && assessment ? `${Math.round(assessment.overallScore)}` : "—"}
          suffix={showResults && assessment ? `/${Math.round(assessment.overallMax)}` : ""}
          sub={showResults ? "Combined MCQs & coding" : "Unlocks after assessment"}
          pct={showResults ? overallPct : 0}
          locked={locked}
        />
        <ScoreCard
          label="MCQs"
          tone="blue"
          title="MCQ score"
          value={showResults && assessment ? `${Math.round(assessment.mcqScore)}` : "—"}
          suffix={showResults && assessment ? `/${Math.round(assessment.mcqMax)}` : ""}
          sub={showResults && assessment ? `${assessment.mcqPct}% correct` : "Unlocks after assessment"}
          pct={showResults && assessment ? assessment.mcqPct : 0}
          locked={locked}
        />
        <ScoreCard
          label="Coding"
          tone="green"
          title="Coding score"
          value={showResults && assessment ? `${Math.round(assessment.codingScore)}` : "—"}
          suffix={showResults && assessment ? `/${Math.round(assessment.codingMax)}` : ""}
          sub={showResults && assessment ? `${assessment.codingPct}% solved` : "Unlocks after assessment"}
          pct={showResults && assessment ? assessment.codingPct : 0}
          locked={locked}
        />
      </div>

      {showResults && assessment ? (
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
          <p className="text-xs font-medium text-muted2">{lockedMessage}</p>
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
