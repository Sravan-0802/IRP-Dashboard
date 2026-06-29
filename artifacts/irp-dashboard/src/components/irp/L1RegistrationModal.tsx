import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AVAILABILITY_OPTIONS,
  L1_HUSTLER_CALENDAR,
  L1_HUSTLER_SLOTS,
  type AvailabilityValue,
  type L1RegistrationRecord,
} from "@/lib/l1AssessmentSchedule";
import { cn } from "@/lib/utils";

interface L1RegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId?: string;
  submitting?: boolean;
  onSubmit?: (record: L1RegistrationRecord) => Promise<L1RegistrationRecord | void>;
  onComplete?: (record: L1RegistrationRecord) => void;
}

function QuestionCard({
  step,
  title,
  children,
  className,
}: {
  step: number;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[rgba(103,65,217,0.1)] bg-white p-4 shadow-[0_8px_24px_-18px_rgba(103,65,217,0.35)] sm:p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6741d9] to-[#3b5bdb] font-display text-xs font-extrabold text-white shadow-sm">
          {step}
        </span>
        <h3 className="font-display text-sm font-extrabold text-ink sm:text-base">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function CommitCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3.5 transition-all",
        checked
          ? "border-[#3b5bdb] bg-gradient-to-br from-[#eef2ff] to-[#f8f0ff] shadow-[0_0_0_3px_rgba(59,91,219,0.12)]"
          : "border-[rgba(103,65,217,0.12)] bg-[rgba(103,65,217,0.03)] hover:border-[rgba(103,65,217,0.25)] hover:bg-[rgba(103,65,217,0.05)]",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5 data-[state=checked]:border-[#3b5bdb] data-[state=checked]:bg-[#3b5bdb]"
      />
      <span className="text-sm leading-relaxed text-ink">{children}</span>
    </label>
  );
}

export function L1RegistrationModal({
  open,
  onOpenChange,
  slotId,
  submitting = false,
  onSubmit,
  onComplete,
}: L1RegistrationModalProps) {
  const [availability, setAvailability] = useState<AvailabilityValue | "">("");
  const [understandsGc, setUnderstandsGc] = useState(false);
  const [willAttend, setWillAttend] = useState(false);
  const [unavailabilityReason, setUnavailabilityReason] = useState("");
  const [notifyNextCycle, setNotifyNextCycle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isYes = availability === "yes";
  const isNo = availability === "no-not-prepared" || availability === "no-conflict";
  const selectedSlotLabel = L1_HUSTLER_SLOTS.find((s) => s.id === slotId)?.label;

  useEffect(() => {
    if (!open) {
      setAvailability("");
      setUnderstandsGc(false);
      setWillAttend(false);
      setUnavailabilityReason("");
      setNotifyNextCycle(false);
      setError(null);
    }
  }, [open]);

  function handleAvailabilityChange(value: AvailabilityValue | "") {
    setAvailability(value);
    setError(null);
  }

  async function submit() {
    setError(null);

    if (!availability) {
      setError("Please select your availability.");
      return;
    }

    if (isYes) {
      if (!slotId) {
        setError("Please choose a time slot before registering.");
        return;
      }
      if (!understandsGc || !willAttend) {
        setError("Please confirm both checkboxes to complete registration.");
        return;
      }
    } else if (isNo && !unavailabilityReason.trim()) {
      setError("Please state your reason for unavailability.");
      return;
    }

    const record: L1RegistrationRecord = {
      availability,
      understandsGc: isYes ? understandsGc : undefined,
      willAttend: isYes ? willAttend : undefined,
      unavailabilityReason: isNo ? unavailabilityReason.trim() : undefined,
      notifyNextCycle: isNo ? notifyNextCycle : undefined,
      slotId: isYes ? slotId : undefined,
      submittedAt: new Date().toISOString(),
    };

    setPending(true);
    try {
      const saved = onSubmit ? await onSubmit(record) : record;
      onComplete?.(saved ?? record);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const isSaving = submitting || pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden border-0 bg-[#f8f7ff] p-0 sm:max-w-xl sm:rounded-3xl top-[4vh] translate-x-[-50%] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]">
        {/* Header */}
        <div
          className="relative shrink-0 overflow-hidden border-b border-[rgba(103,65,217,0.12)] px-5 pb-5 pt-6 sm:px-6"
          style={{ background: "linear-gradient(135deg, #eef2ff 0%, #f8f0ff 50%, #fff9db 100%)" }}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[rgba(103,65,217,0.12)] blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff9db] text-[#e67700] shadow-sm ring-4 ring-white/80">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-[rgba(103,65,217,0.15)] bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                <Sparkles className="h-3 w-3" />
                {L1_HUSTLER_CALENDAR.subtitle}
              </div>
              <h2 className="font-display text-xl font-extrabold leading-tight text-ink sm:text-2xl">
                {L1_HUSTLER_CALENDAR.title}
              </h2>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted2">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-brand" />
                  {L1_HUSTLER_CALENDAR.dateLabel}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-brand" />
                  {L1_HUSTLER_CALENDAR.duration}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Body — scrollable middle section */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          <QuestionCard step={1} title="Availability">
            <p className="mb-3 text-sm leading-relaxed text-muted2">
              Are you available to attend the Internship Readiness Path 2.0 Assessment on 5th July 2026?
            </p>
            <select
              id="l1-availability"
              value={availability}
              onChange={(e) => handleAvailabilityChange(e.target.value as AvailabilityValue | "")}
              className="w-full appearance-none rounded-xl border-2 border-[rgba(103,65,217,0.15)] bg-white bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-4 py-3 text-sm font-semibold text-ink shadow-sm outline-none transition-colors focus:border-[#3b5bdb] focus:ring-4 focus:ring-[rgba(59,91,219,0.12)]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236741d9' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              }}
            >
              <option value="">Select an option</option>
              {AVAILABILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </QuestionCard>

          {isYes ? (
            <>
              {selectedSlotLabel ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[rgba(59,91,219,0.2)] bg-gradient-to-r from-[#eef2ff] to-white px-4 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3b5bdb] text-white">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#3b5bdb]">Your slot</p>
                    <p className="text-sm font-extrabold text-ink">{selectedSlotLabel}</p>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl border border-[rgba(245,159,0,0.25)] bg-[#fff9db] px-4 py-3 text-sm font-semibold text-[#e67700]">
                  Choose a time slot on the calendar before submitting.
                </p>
              )}

              <QuestionCard step={2} title="Understanding">
                <p className="mb-3 text-sm text-muted2">I understand that:</p>
                <CommitCheckbox checked={understandsGc} onChange={setUnderstandsGc}>
                  Irrespective of my current Growth Cycle (GC) or course learning stage, I can attend this
                  assessment!
                </CommitCheckbox>
              </QuestionCard>

              <QuestionCard step={3} title="Commitment">
                <p className="mb-3 text-sm text-muted2">
                  If registered for this assessment slot, will you definitely attend?
                </p>
                <CommitCheckbox checked={willAttend} onChange={setWillAttend}>
                  Yes, I will definitely attend!
                </CommitCheckbox>
                <p className="mt-3 rounded-xl border border-[rgba(245,159,0,0.3)] bg-[#fff9db] px-4 py-3 text-xs leading-relaxed text-[#9c6500]">
                  Please note that if you register for the assessment and do not attend without prior communication, it
                  may adversely impact your eligibility for future opportunities. Attendance for assessments is taken
                  very seriously under IRP 2.0, and all absences are recorded.
                </p>
              </QuestionCard>
            </>
          ) : null}

          {isNo ? (
            <>
              <QuestionCard step={2} title="Reason for unavailability">
                <p className="mb-3 text-sm text-muted2">State your reason for unavailability:</p>
                <textarea
                  id="l1-reason"
                  value={unavailabilityReason}
                  onChange={(e) => {
                    setUnavailabilityReason(e.target.value);
                    setError(null);
                  }}
                  rows={4}
                  className="w-full resize-y rounded-xl border-2 border-[rgba(103,65,217,0.12)] bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-[#3b5bdb] focus:ring-4 focus:ring-[rgba(59,91,219,0.12)]"
                  placeholder="Tell us why you cannot attend..."
                />
              </QuestionCard>

              <QuestionCard step={3} title="Next cycle interest">
                <p className="mb-3 text-sm text-muted2">
                  Would you like to be notified when the next assessment slot opens?
                </p>
                <CommitCheckbox checked={notifyNextCycle} onChange={setNotifyNextCycle}>
                  <span className="inline-flex items-center gap-2">
                    <Bell className="h-4 w-4 text-brand" />
                    Yes, notify me for the next available slot
                  </span>
                </CommitCheckbox>
              </QuestionCard>
            </>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-[rgba(245,159,0,0.35)] bg-[#fff9db] px-4 py-3 text-sm font-semibold text-[#e67700]">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-[rgba(103,65,217,0.08)] bg-white px-4 py-4 sm:px-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-2 border-[#dee2e6] bg-white px-5 py-2.5 text-sm font-bold text-muted2 transition-colors hover:bg-[#f8f9fa]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSaving}
            className="btn-pop rounded-xl px-6 py-2.5 text-sm font-bold shadow-[0_8px_20px_-8px_rgba(103,65,217,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Submitting…" : "Submit registration"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function L1RegistrationSuccess({ record }: { record: L1RegistrationRecord }) {
  const slotLabel = L1_HUSTLER_SLOTS.find((s) => s.id === record.slotId)?.label;

  if (record.availability !== "yes") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-[rgba(103,65,217,0.15)] bg-gradient-to-r from-[#f8f0ff] to-white px-4 py-3.5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <p className="text-sm font-medium text-ink">
          Response recorded.{" "}
          {record.notifyNextCycle ? "We will notify you when the next slot opens." : "Thank you for letting us know."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[rgba(12,166,120,0.25)] bg-gradient-to-r from-[#e8faf0] to-white px-4 py-3.5">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
      <p className="text-sm font-semibold text-teal">
        Registered for {slotLabel ?? "your slot"} on {L1_HUSTLER_CALENDAR.dateLabel}.
      </p>
    </div>
  );
}
