import { CalendarClock, ExternalLink, FlaskConical, Lock, Timer, Trophy } from "lucide-react";
import { safeHttpUrl } from "@/lib/programBoard";
import { useCountdown } from "@/lib/useCountdown";
import { isAccessGrantLive, useStudentAccess, type StudentAccessGrant } from "@/lib/useStudentAccess";

function windowTime(value: string | null | undefined): string | null {
  if (!value || !Number.isFinite(new Date(value).getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(value)) + " IST";
}

function AssessmentAccessCard({ grant }: { grant: StudentAccessGrant }) {
  const opening = useCountdown(grant.startsAt);
  const closing = useCountdown(grant.expiresAt);
  if (closing.hasExpiry && closing.isExpired) return null;
  const scheduled = Boolean(grant.startsAt && new Date(grant.startsAt).getTime() > Date.now());
  const href = isAccessGrantLive(grant) ? safeHttpUrl(grant.url) : null;
  const mock = grant.linkKind === "mock";
  const kind = mock ? "Mock" : "Main";
  const Icon = scheduled ? CalendarClock : mock ? FlaskConical : Trophy;
  const starts = windowTime(grant.startsAt);
  const ends = windowTime(grant.expiresAt);

  return (
    <article
      data-testid={`card-genai-access-${grant.batchId}`}
      className="rounded-xl border border-[#d9d6fe] bg-[linear-gradient(120deg,#f4f3ff_0%,#eff8ff_100%)] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#6941c6]">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#6941c6]">
              GenAI · {kind} Assessment · {scheduled ? "Upcoming" : href ? "Live now" : "Checking access"}
            </p>
            <h3 className="mt-1 break-words font-display text-base font-extrabold text-[#101828]">
              {grant.name || `GenAI ${kind} Assessment`}
            </h3>
            {starts ? <p className="mt-1 text-xs text-[#475467]">Opens {starts}</p> : null}
            {ends ? <p className="mt-1 text-xs text-[#475467]">Closes {ends}</p> : null}
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#6941c6]" aria-live="off">
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
          <a href={href} target="_blank" rel="noopener noreferrer"
            data-testid={`link-genai-access-${grant.batchId}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6941c6] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#5925dc]">
            <ExternalLink className="h-4 w-4" /> Start {kind} Assessment
          </a>
        ) : (
          <button type="button" disabled
            data-testid={`button-genai-access-${grant.batchId}`}
            className="inline-flex min-h-11 shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#e9d7fe] px-5 py-2.5 text-sm font-bold text-[#6941c6]">
            <Lock className="h-4 w-4" /> {scheduled ? "Opens at scheduled time" : "Checking access…"}
          </button>
        )}
      </div>
    </article>
  );
}

/** The server supplies only this student's enabled, unexpired roster grants.
 * Upcoming grants deliberately have no URL until their opening time. */
export function GenaiAssessmentAccess() {
  const { grants } = useStudentAccess();
  const assessments = grants.filter(
    (grant) => grant.stage === "genai_assessment" &&
      (grant.linkKind === "mock" || grant.linkKind === "main"),
  );
  if (!assessments.length) return null;
  return (
    <section aria-label="Your GenAI assessment access" className="space-y-3">
      {assessments.map((grant) => <AssessmentAccessCard key={grant.batchId} grant={grant} />)}
    </section>
  );
}
