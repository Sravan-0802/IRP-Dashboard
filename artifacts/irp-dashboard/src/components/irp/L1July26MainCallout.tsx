import { ExternalLink, Timer, Trophy } from "lucide-react";
import {
  L1_JULY26_MAIN_ASSESSMENT_TITLE,
} from "@/lib/l1July26MainConfig";
import { trackDashboardEvent, DASHBOARD_ANALYTICS_EVENTS } from "@/lib/analytics";
import { useStudentAccess } from "@/lib/useStudentAccess";
import { useCountdown } from "@/lib/useCountdown";

interface L1July26MainCalloutProps {
  userId: string;
}

/** L1 main link — only from a live `online_assessment` main access-grant row. */
export function L1July26MainCallout(_props: L1July26MainCalloutProps) {
  const { findGrant } = useStudentAccess();
  const grant = findGrant("online_assessment", "main");
  const href = grant?.url?.trim() || null;
  const { timeLeft } = useCountdown(grant?.expiresAt);

  if (!href) return null;

  function onStartMain() {
    trackDashboardEvent(DASHBOARD_ANALYTICS_EVENTS.MAIN_ASSESSMENT_LINK_CLICK);
  }

  return (
    <div className="rounded-xl border border-[rgba(245,159,0,0.28)] bg-[linear-gradient(120deg,#fff9db_0%,#fff5f5_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#e67700] shadow-sm ring-1 ring-[rgba(245,159,0,0.16)]">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e67700]">
              L1 · Main Assessment — Live now
            </p>
            <h3 className="font-display text-base font-extrabold text-ink sm:text-lg">
              {L1_JULY26_MAIN_ASSESSMENT_TITLE}
            </h3>
            <p className="mt-0.5 text-sm text-muted2">
              Your main assessment link is ready. Open the link and begin.
            </p>
            {timeLeft ? (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-[rgba(230,119,0,0.1)] px-2 py-1 text-xs font-bold text-[#e67700]">
                <Timer className="h-3 w-3 shrink-0" />
                {timeLeft} remaining
              </p>
            ) : null}
          </div>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onStartMain}
          className="btn-pop inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl px-5 py-2.5 text-sm font-bold sm:self-center"
        >
          <ExternalLink className="h-4 w-4" />
          Start Assessment
        </a>
      </div>
    </div>
  );
}
