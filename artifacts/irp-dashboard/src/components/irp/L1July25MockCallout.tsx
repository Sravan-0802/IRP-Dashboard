import { ExternalLink, FlaskConical, Timer } from "lucide-react";
import { isL1July25MockLinkOpen } from "@/lib/irpDates";
import { isInL1July25MockAllowlist } from "@/lib/l1July25MockAllowlist";
import {
  L1_JULY25_MOCK_AVAILABLE_UNTIL,
  L1_JULY25_MOCK_TITLE,
  L1_JULY25_MOCK_URL,
  L1_JULY25_MOCK_WINDOW_LABEL,
} from "@/lib/l1July25MockConfig";
import { trackDashboardEvent, DASHBOARD_ANALYTICS_EVENTS } from "@/lib/analytics";
import { useStudentAccess } from "@/lib/useStudentAccess";
import { useCountdown } from "@/lib/useCountdown";

interface L1July25MockCalloutProps {
  userId: string;
}

/** Online Assessment mock — grant URL preferred; else allowlist + date window. */
export function L1July25MockCallout({ userId }: L1July25MockCalloutProps) {
  const { findGrant } = useStudentAccess();
  const grant = findGrant("online_assessment", "mock");
  const grantUrl = grant?.url?.trim() || null;
  const { timeLeft, isExpired } = useCountdown(grant?.expiresAt);

  // Grant exists but expired client-side → hide
  if (grantUrl && isExpired) return null;

  if (!grantUrl) {
    if (!isInL1July25MockAllowlist(userId) || !isL1July25MockLinkOpen()) return null;
  }

  const href = grantUrl ?? L1_JULY25_MOCK_URL;

  function onStartMock() {
    trackDashboardEvent(DASHBOARD_ANALYTICS_EVENTS.L1_JULY25_MOCK_START_CLICK);
  }

  return (
    <div className="rounded-xl border border-[rgba(103,65,217,0.2)] bg-[linear-gradient(120deg,#f3f0ff_0%,#eef2ff_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-[rgba(103,65,217,0.12)]">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
              L1 · Mock Assessment
            </p>
            <h3 className="font-display text-base font-extrabold text-ink sm:text-lg">
              {L1_JULY25_MOCK_TITLE}
            </h3>
            <p className="mt-0.5 text-sm text-muted2">
              {grantUrl
                ? "Your L1 mock assessment link is ready."
                : `Complete the L1 mock assessment. Available until ${L1_JULY25_MOCK_AVAILABLE_UNTIL}.`}
            </p>
            {grantUrl && timeLeft ? (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-[rgba(103,65,217,0.08)] px-2 py-1 text-xs font-bold text-brand">
                <Timer className="h-3 w-3 shrink-0" />
                {timeLeft} remaining
              </p>
            ) : !grantUrl ? (
              <p className="mt-1.5 text-xs font-semibold text-brand">
                🕐 {L1_JULY25_MOCK_WINDOW_LABEL}
              </p>
            ) : null}
          </div>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onStartMock}
          className="btn-pop inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl px-5 py-2.5 text-sm font-bold sm:self-center"
        >
          <ExternalLink className="h-4 w-4" />
          Start Mock
        </a>
      </div>
    </div>
  );
}
