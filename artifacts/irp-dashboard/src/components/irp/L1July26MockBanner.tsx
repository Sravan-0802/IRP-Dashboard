import { ExternalLink, FlaskConical } from "lucide-react";
import { L1_JULY26_MOCK_ASSESSMENT_URL } from "@/lib/l1AssessmentSchedule";
import { trackDashboardEvent, DASHBOARD_ANALYTICS_EVENTS } from "@/lib/analytics";

/**
 * Shown to July 26 registered students during the mock assessment window
 * (25 Jul 2:00 PM IST → 26 Jul 10:00 AM IST).
 */
export function L1July26MockBanner({ compact = false }: { compact?: boolean }) {
  function openMock() {
    trackDashboardEvent(DASHBOARD_ANALYTICS_EVENTS.L1_JULY25_MOCK_START_CLICK);
    window.open(L1_JULY26_MOCK_ASSESSMENT_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[rgba(103,65,217,0.25)] p-5 shadow-soft sm:p-6"
      style={{ background: "linear-gradient(130deg, #ede9fe 0%, #f3f0ff 55%, #fff9db 100%)" }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[rgba(103,65,217,0.12)] blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
              Level 1 · The Hustler
            </p>
            <p
              className={`mt-1 font-display font-extrabold text-ink ${compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"}`}
            >
              IRP 2.0 L1 Mock Assessment — Live Now
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted2">
              Your mock assessment is live. Attempting the mock is{" "}
              <span className="font-semibold text-ink">mandatory</span> before the main exam.
              Click the button to begin when you're ready.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openMock}
          className="btn-pop inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          <ExternalLink className="h-4 w-4" />
          Start Mock Assessment
        </button>
      </div>
    </div>
  );
}
