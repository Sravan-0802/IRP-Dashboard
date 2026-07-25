import { ExternalLink, FlaskConical } from "lucide-react";
import { isL1July25MockLinkOpen } from "@/lib/irpDates";
import { isInL1July25MockAllowlist } from "@/lib/l1July25MockAllowlist";
import {
  L1_JULY25_MOCK_AVAILABLE_UNTIL,
  L1_JULY25_MOCK_TITLE,
  L1_JULY25_MOCK_URL,
  L1_JULY25_MOCK_WINDOW_LABEL,
} from "@/lib/l1July25MockConfig";
import { trackDashboardEvent, DASHBOARD_ANALYTICS_EVENTS } from "@/lib/analytics";

interface L1July25MockCalloutProps {
  userId: string;
}

/** Shown only for L1-registered (allowlisted) students within the mock window. */
export function L1July25MockCallout({ userId }: L1July25MockCalloutProps) {
  if (!isL1July25MockLinkOpen()) return null;
  if (!isInL1July25MockAllowlist(userId)) return null;

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
              Complete the L1 mock assessment. Available until {L1_JULY25_MOCK_AVAILABLE_UNTIL}.
            </p>
            <p className="mt-1.5 text-xs font-semibold text-brand">
              🕐 {L1_JULY25_MOCK_WINDOW_LABEL}
            </p>
          </div>
        </div>

        <a
          href={L1_JULY25_MOCK_URL}
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
