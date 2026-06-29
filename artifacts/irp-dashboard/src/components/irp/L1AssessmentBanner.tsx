import { CalendarClock, CheckCircle2, Megaphone } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import {
  hasSuccessfulSlotRegistration,
  L1_BANNER_TEXT,
  L1_HUSTLER_SLOTS,
  L1_REGISTRATION_BANNER_EYEBROW,
  L1_REGISTRATION_BANNER_TITLE,
  L1_REGISTRATION_CLOSED_BANNER_TEXT,
  L1_REGISTRATION_CLOSED_BANNER_TITLE,
  L1_REGISTRATION_SUCCESS_BANNER_TEXT,
  L1_REGISTRATION_SUCCESS_BANNER_TITLE,
  type L1RegistrationRecord,
} from "@/lib/l1AssessmentSchedule";
import { isL1RegistrationOpen } from "@/lib/irpDates";
import { shouldShowCycle2Banner } from "@/lib/l1StudentTrack";

export function L1AssessmentBanner({
  assessments = [],
  registration = null,
  onRegisterClick,
  compact = false,
}: {
  assessments?: AssessmentResult[];
  registration?: L1RegistrationRecord | null;
  onRegisterClick?: () => void;
  compact?: boolean;
}) {
  if (!shouldShowCycle2Banner(assessments)) return null;

  const slotBooked = hasSuccessfulSlotRegistration(registration);
  const registrationOpen = isL1RegistrationOpen();

  if (slotBooked) {
    const slotLabel = L1_HUSTLER_SLOTS.find((s) => s.id === registration?.slotId)?.label;
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(12,166,120,0.25)] p-5 shadow-soft sm:p-6"
        style={{ background: "linear-gradient(130deg, #e8faf0 0%, #f0fdf8 55%, #ffffff 100%)" }}
      >
        <div className="relative flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-teal shadow-sm">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">
              {L1_REGISTRATION_BANNER_EYEBROW}
            </p>
            <p className={`mt-1 font-display font-extrabold text-ink ${compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"}`}>
              {L1_REGISTRATION_SUCCESS_BANNER_TITLE}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted2">
              {L1_REGISTRATION_SUCCESS_BANNER_TEXT}
              {slotLabel ? (
                <>
                  {" "}
                  Your slot: <span className="font-semibold text-ink">{slotLabel}</span>.
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!registrationOpen) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-[rgba(103,65,217,0.15)] p-5 shadow-soft sm:p-6"
        style={{ background: "linear-gradient(130deg, #f8f9fa 0%, #f3f0ff 100%)" }}
      >
        <div className="relative flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-muted2 shadow-sm">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted2">
              {L1_REGISTRATION_BANNER_EYEBROW}
            </p>
            <p className={`mt-1 font-display font-extrabold text-ink ${compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"}`}>
              {L1_REGISTRATION_CLOSED_BANNER_TITLE}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted2">{L1_REGISTRATION_CLOSED_BANNER_TEXT}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[rgba(103,65,217,0.2)] p-5 shadow-soft sm:p-6"
      style={{ background: "linear-gradient(130deg, #eef2ff 0%, #f8f0ff 55%, #fff9db 100%)" }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[rgba(103,65,217,0.12)] blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
              {L1_REGISTRATION_BANNER_EYEBROW}
            </p>
            <p className={`mt-1 font-display font-extrabold text-ink ${compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"}`}>
              {L1_REGISTRATION_BANNER_TITLE}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted2">{L1_BANNER_TEXT}</p>
          </div>
        </div>
        {onRegisterClick ? (
          <button
            type="button"
            onClick={onRegisterClick}
            className="btn-pop inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            <CalendarClock className="h-4 w-4" />
            Register now
          </button>
        ) : null}
      </div>
    </div>
  );
}
