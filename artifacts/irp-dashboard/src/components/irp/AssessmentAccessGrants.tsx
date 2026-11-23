import { CalendarClock, ExternalLink, FlaskConical, Lock, Timer, Trophy } from "lucide-react";
import { accessStageLabel, isGenaiAccessStage } from "@/lib/accessStages";
import { safeHttpUrl } from "@/lib/programBoard";
import { useCountdown } from "@/lib/useCountdown";
import { isAccessGrantLive, useStudentAccess, type StudentAccessGrant } from "@/lib/useStudentAccess";

export type AssessmentAccessTrack = "all" | "mern" | "genai";

function windowTime(value: string | null | undefined): string | null {
  if (!value || !Number.isFinite(new Date(value).getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value)) + " IST";
}

function AssessmentGrantCard({ grant }: { grant: StudentAccessGrant }) {
  const opening = useCountdown(grant.startsAt);
  const closing = useCountdown(grant.expiresAt);
  if (closing.hasExpiry && closing.isExpired) return null;

  const genai = isGenaiAccessStage(grant.stage);
  const trackName = genai ? "GenAI" : "MERN";
  const scheduled = Boolean(grant.startsAt && new Date(grant.startsAt).getTime() > Date.now());
  const href = isAccessGrantLive(grant) ? safeHttpUrl(grant.url) : null;
  const mock = grant.linkKind === "mock";
  const kind = grant.linkKind === "default" ? "" : mock ? "Mock" : "Main";
  const title = `${accessStageLabel(grant.stage)}${kind ? ` · ${kind}` : ""}`;
  const Icon = scheduled ? CalendarClock : mock ? FlaskConical : grant.linkKind === "main" ? Trophy : CalendarClock;
  const starts = windowTime(grant.startsAt);
  const ends = windowTime(grant.expiresAt);
  const action = kind ? `${kind} Assessment` : accessStageLabel(grant.stage);

  return (
    <article
      data-testid={`card-assessment-grant-${grant.batchId}`}
      className="rounded-xl border border-[#d9d6fe] bg-[linear-gradient(120deg,#f4f3ff_0%,#eff8ff_100%)] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#6941c6]">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#6941c6]">
              {trackName} · {title} · {scheduled ? "Upcoming" : href ? "Live now" : "Checking access"}
            </p>
            <h3 className="mt-1 break-words font-display text-base font-extrabold text-[#101828]">
              {grant.name || title}
            </h3>
            {starts ? <p className="mt-1 text-xs text-[#475467]">Opens {starts}</p> : null}
            {ends ? <p className="mt-1 text-xs text-[#475467]">Closes {ends}</p> : null}
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#6941c6]">
              <Timer className="h-3.5 w-3.5" />
              {scheduled
                ? `Starts in ${opening.timeLeft}`
                : href
                  ? closing.hasExpiry ? `${closing.timeLeft} remaining` : "Your assessment link is ready."
                  : "Opening assessment — checking access…"}
            </p>
          </div>
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`link-assessment-grant-${grant.batchId}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6941c6] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#5925dc]"
          >
            <ExternalLink className="h-4 w-4" /> Open {action}
          </a>
        ) : (
          <button
            type="button"
            disabled
            data-testid={`button-assessment-grant-${grant.batchId}`}
            className="inline-flex min-h-11 shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#e9d7fe] px-5 py-2.5 text-sm font-bold text-[#6941c6]"
          >
            <Lock className="h-4 w-4" /> {scheduled ? "Opens at scheduled time" : "Checking access…"}
          </button>
        )}
      </div>
    </article>
  );
}

const MERN_ASSESSMENT_STAGES = new Set([
  "online_assessment",
  "fe_project",
  "ai_mock",
  "human_interview",
]);

function isAssessmentGrant(grant: StudentAccessGrant): boolean {
  return MERN_ASSESSMENT_STAGES.has(grant.stage) ||
    grant.stage === "genai_assessment" ||
    grant.stage === "genai_ai_interview";
}

/** Roster-scoped assessment access; calendar entries remain on Assessment Calendar. */
export function AssessmentAccessGrants({ track = "all" }: { track?: AssessmentAccessTrack }) {
  const { grants } = useStudentAccess();
  const assessments = grants.filter((grant) => {
    if (!isAssessmentGrant(grant)) return false;
    const genai = isGenaiAccessStage(grant.stage);
    return track === "all" || (track === "genai" ? genai : !genai);
  });

  if (!assessments.length) return null;
  return (
    <section aria-label={`${track === "all" ? "Assigned" : track === "genai" ? "GenAI" : "MERN"} assessment access`} className="space-y-3">
      {assessments.map((grant) => <AssessmentGrantCard key={grant.batchId} grant={grant} />)}
    </section>
  );
}
