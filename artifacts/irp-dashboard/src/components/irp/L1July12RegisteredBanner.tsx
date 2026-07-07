import { CalendarCheck } from "lucide-react";
import {
  L1_JULY12_REGISTERED_BANNER_EYEBROW,
  L1_JULY12_REGISTERED_BANNER_TITLE,
  L1_JULY12_REGISTERED_BANNER_TEXT,
} from "@/lib/l1AssessmentSchedule";

/**
 * Confirmation banner for the fixed 12 July 2026 (Cycle 2) assessment cohort.
 * Render only when the student is on the uploaded cohort list.
 */
export function L1July12RegisteredBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[rgba(12,166,120,0.25)] p-5 shadow-soft sm:p-6"
      style={{ background: "linear-gradient(130deg, #e8faf0 0%, #f3f0ff 100%)" }}
    >
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-teal shadow-sm">
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">
            {L1_JULY12_REGISTERED_BANNER_EYEBROW}
          </p>
          <p
            className={`mt-1 font-display font-extrabold text-ink ${compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"}`}
          >
            {L1_JULY12_REGISTERED_BANNER_TITLE}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted2">
            {L1_JULY12_REGISTERED_BANNER_TEXT}
          </p>
        </div>
      </div>
    </div>
  );
}
