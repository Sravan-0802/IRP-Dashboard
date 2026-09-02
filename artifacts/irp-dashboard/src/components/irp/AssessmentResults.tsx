import { ClipboardCheck, Lock } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { getLevel, getPhase } from "@/lib/journey";
import { areAssignmentResultsVisible } from "@/lib/irpDates";
import {
  assessmentOverallPct,
  formatAssessmentTitle,
  getAssessmentStepStatus,
  hasClearedAssessment,
  hasWrittenAssessment,
  isAssessmentResultsLocked,
  listAttemptedL1OnlineAssessments,
  pickAssessmentForLevel,
  pickL1AssessmentForResults,
} from "@/lib/assessment";
import { isCycle1Cleared } from "@/lib/l1StudentTrack";
import {
  formatL1OnlineStatus,
  formatL1OnlineStatusForAssessments,
  l1OnlineStatusTone,
  studentResultStatusLabel,
} from "@/lib/studentStatusDisplay";
import { useVisibilitySettings } from "@/lib/useVisibilitySettings";
import { ProgressRing, Pill } from "./ui";

export function AssessmentResults({
  journey,
  assessments,
  userId,
}: {
  journey: Journey;
  examDateLabel?: string;
  assessments: AssessmentResult[];
  userId?: string;
}) {
  const { settings } = useVisibilitySettings();
  const onlineL1ResultsVisible = settings.onlineL1Results;
  const level = getLevel(journey.journeyState);
  const phase = getPhase(journey.journeyState);
  const resultsUnlockedByDate =
    areAssignmentResultsVisible() ||
    phase === "POST_ASSESSMENT" ||
    phase === "PLACED";

  const assessment =
    level === 1
      ? pickL1AssessmentForResults(assessments, onlineL1ResultsVisible)
      : pickAssessmentForLevel(assessments, level);

  const previousSits =
    level === 1 ? listAttemptedL1OnlineAssessments(assessments) : [];

  const assessmentStatus = getAssessmentStepStatus(assessments, level);
  const l1Cleared = level === 1 && hasClearedAssessment(assessments, 1);
  const cycle1Track = level === 1 && isCycle1Cleared(assessments, userId);
  const title = formatAssessmentTitle(assessment?.assessmentTitle, level);
  const statusLabel =
    level === 1
      ? formatL1OnlineStatusForAssessments(assessments)
      : assessment
        ? studentResultStatusLabel(assessment)
        : "Not attempted";
  const featuredStatusLabel = assessment ? formatL1OnlineStatus(assessment) : statusLabel;

  const locked = isAssessmentResultsLocked(
    assessments,
    level,
    resultsUnlockedByDate,
    onlineL1ResultsVisible,
  );
  const showResults = !locked;
  const overallPct = assessment ? assessmentOverallPct(assessment) : 0;

  const lockedMessage = (() => {
    if (hasWrittenAssessment(assessments, level) && !showResults) {
      return "Your assessment results are syncing. Check back shortly.";
    }
    if (!hasWrittenAssessment(assessments, level)) {
      return "Complete your online L1 assessment to unlock your results here.";
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
          <p className="mt-0.5 text-xs text-muted2">{title}</p>
          {assessment && (assessmentStatus === "attempted_not_cleared" || assessmentStatus === "done") ? (
            <p className="mt-1 text-xs text-muted2">
              {l1Cleared || cycle1Track
                ? "Your qualifying L1 online assessment result is shown below."
                : "Your latest L1 online assessment result is shown below."}
              {previousSits.length > 1 ? " Earlier sits are listed in the table." : null}
            </p>
          ) : null}
        </div>
        {showResults && assessment ? (
          <Pill tone={l1OnlineStatusTone(assessment)}>{featuredStatusLabel}</Pill>
        ) : (
          <Pill tone="grey">{statusLabel}</Pill>
        )}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
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

      {showResults && previousSits.length > 1 ? (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
            All sits
          </p>
          <div className="overflow-hidden rounded-xl border border-[rgba(103,65,217,0.12)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(103,65,217,0.10)] bg-[rgba(103,65,217,0.04)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                  <th className="px-3 py-2">Sit</th>
                  <th className="px-3 py-2">Overall</th>
                  <th className="px-3 py-2">MCQ</th>
                  <th className="px-3 py-2">Coding</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {previousSits.map((sit, index) => {
                  const pct = assessmentOverallPct(sit);
                  const sitStatus = formatL1OnlineStatus(sit);
                  return (
                    <tr
                      key={`${sit.organisationAssessmentId}-${sit.assessmentStartDatetime ?? index}`}
                      className="border-b border-[rgba(103,65,217,0.06)] last:border-b-0"
                    >
                      <td className="px-3 py-2.5 font-medium text-ink">Sit {previousSits.length - index}</td>
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
                        <Pill tone={l1OnlineStatusTone(sit)}>{sitStatus}</Pill>
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
