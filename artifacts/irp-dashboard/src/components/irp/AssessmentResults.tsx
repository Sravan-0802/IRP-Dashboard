import { ClipboardCheck, Lock } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase } from "@/lib/journey";
import { areAssignmentResultsVisible, L1_CYCLE1_EXAM_DATE_LABEL, L1_CYCLE2_EXAM_DATE_LABEL, L1_JULY12_EXAM_DATE_LABEL } from "@/lib/irpDates";
import {
  assessmentOverallPct,
  formatAssessmentTitle,
  getAssessmentStepStatus,
  getExamDateLabelForAssessment,
  getL1ClearedExamDateLabel,
  hasAttemptedL1Cycle2,
  hasClearedAssessment,
  hasWrittenAssessment,
  isAssessmentResultsLocked,
  listAttemptedL1OnlineAssessments,
  pickAssessmentForLevel,
  pickL1AssessmentForResults,
  resultLabel,
  resultTone,
} from "@/lib/assessment";
import { isCycle1Cleared, isCycle2Candidate } from "@/lib/l1StudentTrack";
import { useVisibilitySettings } from "@/lib/useVisibilitySettings";
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
  const { settings } = useVisibilitySettings();
  const onlineL1ResultsVisible = settings.onlineL1Results;
  const level = getLevel(journey.journeyState);
  const phase = getPhase(journey.journeyState);
  const resultsUnlockedByDate =
    areAssignmentResultsVisible() ||
    phase === "POST_ASSESSMENT" ||
    phase === "PLACED";

  // Latest result card = round-wise (or best detail). History = detail sits only.
  const assessment =
    level === 1
      ? pickL1AssessmentForResults(assessments, onlineL1ResultsVisible)
      : pickAssessmentForLevel(assessments, level);

  const previousSits =
    level === 1 ? listAttemptedL1OnlineAssessments(assessments) : [];

  const assessmentStatus = getAssessmentStepStatus(assessments, level);
  const cycle1Cleared = level === 1 && isCycle1Cleared(assessments);
  const cycle2Track = level === 1 && isCycle2Candidate(assessments);
  const title = formatAssessmentTitle(assessment?.assessmentTitle, level);

  const resultsDateLabel = (() => {
    if (cycle1Cleared) return getL1ClearedExamDateLabel(assessments);
    if (assessment && (assessmentStatus === "attempted_not_cleared" || assessmentStatus === "done")) {
      const sitLabel = getExamDateLabelForAssessment(assessment);
      if (cycle2Track && hasAttemptedL1Cycle2(assessments)) {
        return `${sitLabel} · Next: ${L1_JULY12_EXAM_DATE_LABEL}`;
      }
      if (cycle2Track && assessmentStatus === "attempted_not_cleared") {
        return `${sitLabel} · Next: ${L1_JULY12_EXAM_DATE_LABEL}`;
      }
      return sitLabel;
    }
    if (cycle2Track && hasAttemptedL1Cycle2(assessments)) {
      return `${L1_CYCLE2_EXAM_DATE_LABEL} · Next: ${L1_JULY12_EXAM_DATE_LABEL}`;
    }
    if (cycle2Track && assessmentStatus === "attempted_not_cleared") {
      return `${L1_CYCLE1_EXAM_DATE_LABEL} · Next: ${L1_JULY12_EXAM_DATE_LABEL}`;
    }
    if (cycle2Track) return L1_JULY12_EXAM_DATE_LABEL;
    return examDateLabel;
  })();

  const locked = isAssessmentResultsLocked(
    assessments,
    level,
    resultsUnlockedByDate,
    onlineL1ResultsVisible,
  );
  const showResults = !locked;
  const overallPct = assessment ? assessmentOverallPct(assessment) : 0;

  const lockedMessage = (() => {
    if (hasAttemptedL1Cycle2(assessments) && !onlineL1ResultsVisible) {
      return (
        <>
          You completed the {L1_CYCLE2_EXAM_DATE_LABEL} / 12th July assessment. Results are synced
          and will appear on your dashboard once released by the team.
        </>
      );
    }
    if (!resultsUnlockedByDate && !hasWrittenAssessment(assessments, level)) {
      return (
        <>
          Your assessment is on{" "}
          <span className="font-bold text-ink">
            {cycle2Track ? L1_JULY12_EXAM_DATE_LABEL : examDateLabel}
          </span>
          . Results will appear here after you complete it.
        </>
      );
    }
    if (!hasWrittenAssessment(assessments, level)) {
      return (
        <>
          Complete your online assessment on{" "}
          <span className="font-bold text-ink">
            {cycle2Track ? L1_JULY12_EXAM_DATE_LABEL : examDateLabel}
          </span>{" "}
          to unlock your results.
        </>
      );
    }
    return "Your assessment results are syncing. Check back shortly.";
  })();

  return (
    <div id="assessment-results" className="irp-card scroll-mt-24 p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-extrabold">
            <ClipboardCheck className="h-4 w-4 text-brand-2" />
            <span className="text-gradient-brand">Assessment Results</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted2">
            {title} · Latest: {resultsDateLabel}
            {assessment?.attemptNumber != null ? ` · Attempt ${assessment.attemptNumber}` : ""}
          </p>
          {assessment && (assessmentStatus === "attempted_not_cleared" || assessmentStatus === "done") ? (
            <p className="mt-1 text-xs text-muted2">
              Clearance is based on your latest attempt ({getExamDateLabelForAssessment(assessment)}
              ).
              {previousSits.length > 0
                ? " Earlier sits are listed below."
                : null}
              {cycle2Track && !hasClearedAssessment(assessments, 1)
                ? ` Register for ${L1_JULY12_EXAM_DATE_LABEL} to reattempt if needed.`
                : null}
            </p>
          ) : null}
        </div>
        {showResults && assessment && (
          <Pill tone={resultTone(overallPct)}>{resultLabel(overallPct, assessment)}</Pill>
        )}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        <ScoreCard
          label="Overall"
          tone="purple"
          title="Total score"
          value={showResults && assessment ? `${Math.round(assessment.overallScore)}` : "—"}
          suffix={showResults && assessment ? `/${Math.round(assessment.overallMax)}` : ""}
          sub={showResults ? "Combined MCQs & coding (latest)" : "Unlocks after assessment"}
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

      {showResults && previousSits.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
            Previous attempts
          </p>
          <div className="overflow-hidden rounded-xl border border-[rgba(103,65,217,0.12)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(103,65,217,0.10)] bg-[rgba(103,65,217,0.04)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                  <th className="px-3 py-2">Cycle</th>
                  <th className="px-3 py-2">Attempt</th>
                  <th className="px-3 py-2">Overall</th>
                  <th className="px-3 py-2">MCQ</th>
                  <th className="px-3 py-2">Coding</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {previousSits.map((sit) => {
                  const pct = assessmentOverallPct(sit);
                  return (
                    <tr
                      key={`${sit.organisationAssessmentId}-${sit.assessmentStartDatetime ?? ""}`}
                      className="border-b border-[rgba(103,65,217,0.06)] last:border-b-0"
                    >
                      <td className="px-3 py-2.5 font-medium text-ink">
                        {getExamDateLabelForAssessment(sit)}
                      </td>
                      <td className="px-3 py-2.5 text-[#6e6a8a]">
                        {sit.attemptNumber != null ? sit.attemptNumber : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[#6e6a8a]">
                        {Math.round(sit.overallScore)}/{Math.round(sit.overallMax)} ({pct}%)
                      </td>
                      <td className="px-3 py-2.5 text-[#6e6a8a]">
                        {Math.round(sit.mcqScore)}/{Math.round(sit.mcqMax)}
                      </td>
                      <td className="px-3 py-2.5 text-[#6e6a8a]">
                        {Math.round(sit.codingScore)}/{Math.round(sit.codingMax)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill tone={resultTone(pct)}>{resultLabel(pct, sit)}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!showResults || !assessment ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[rgba(103,65,217,0.1)] bg-[rgba(248,247,255,0.8)] px-4 py-3">
          <Lock className="h-4 w-4 shrink-0 text-muted2" />
          <p className="text-xs font-medium text-muted2">{lockedMessage}</p>
        </div>
      ) : null}
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
