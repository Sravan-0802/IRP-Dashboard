import { CalendarClock, Clock3 } from "lucide-react";
import { L1_ACCESS_STAGE_LABELS } from "@/lib/l1StageAccessMatrix";
import { useCountdown } from "@/lib/useCountdown";
import { isAccessGrantLive, useStudentAccess, type StudentAccessGrant } from "@/lib/useStudentAccess";

function formatOpeningTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value)) + " IST";
}

function ScheduledAccessCard({ grant }: { grant: StudentAccessGrant }) {
  const { timeLeft, isExpired: hasStarted } = useCountdown(grant.startsAt);
  const kind = grant.linkKind === "default" ? "" : ` · ${grant.linkKind === "mock" ? "Mock" : "Main"}`;
  const title = `${L1_ACCESS_STAGE_LABELS[grant.stage]}${kind}`;
  return (
    <section className="rounded-xl border border-[rgba(103,65,217,0.2)] bg-[linear-gradient(120deg,#f3f0ff_0%,#eef2ff_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <CalendarClock className="mt-1 h-5 w-5 shrink-0 text-brand" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
              Upcoming assessment
            </p>
            <h3 className="font-display text-base font-extrabold text-ink">{title}</h3>
            {grant.name ? <p className="mt-0.5 text-sm text-muted2">{grant.name}</p> : null}
            <p className="mt-1 text-sm font-semibold text-ink">
              Opens {formatOpeningTime(grant.startsAt!)}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand">
              <Clock3 className="h-3 w-3" />
              {hasStarted ? "Opening assessment — checking access…" : `Starts in ${timeLeft}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex shrink-0 cursor-not-allowed items-center justify-center rounded-xl bg-brand/10 px-5 py-2.5 text-sm font-bold text-muted2"
          aria-label={`${title}: unavailable until the opening time`}
        >
          {grant.linkKind === "mock" ? "Start Mock" : "Start Assessment"}
        </button>
      </div>
    </section>
  );
}

/** Uploaded roster membership makes the upcoming schedule visible; live CTA gates stay unchanged. */
export function ScheduledAccessCallouts() {
  const { grants } = useStudentAccess();
  const scheduled = grants.filter(
    (g) => g.startsAt && (!isAccessGrantLive(g) || !g.url?.trim()),
  );
  if (!scheduled.length) return null;
  return (
    <div className="grid gap-3" aria-label="Upcoming assessment access">
      {scheduled.map((grant) => <ScheduledAccessCard key={grant.batchId} grant={grant} />)}
    </div>
  );
}
