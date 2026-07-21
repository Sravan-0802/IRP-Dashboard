import { useEffect, useState } from "react";
import { Calendar, Clock, Trophy, CheckCircle2, CalendarCheck } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import { IrpCard } from "@/components/irp/ui";
import { ComingSoonPanel } from "@/components/irp/ComingSoonPanel";
import { L1RegistrationModal, L1RegistrationSuccess } from "@/components/irp/L1RegistrationModal";
import {
  L1_JULY26_HUSTLER_CALENDAR,
  L1_JULY26_HUSTLER_SLOTS,
  getL1HustlerSlot,
  syncL1HustlerSlotFromRegistration,
  type L1RegistrationRecord,
} from "@/lib/l1AssessmentSchedule";
import { hasSuccessfulSlotRegistration } from "@/lib/l1AssessmentSchedule";
import { L1_JULY26_EXAM_DATE_LABEL, isL1July26RegistrationOpen } from "@/lib/irpDates";
import { isCycle1Cleared, isCycle2Candidate } from "@/lib/l1StudentTrack";
import { useL1Registration } from "@/lib/useL1Registration";

const JULY26_DEFAULT_SLOT = L1_JULY26_HUSTLER_SLOTS[0]?.id;

function AssessmentCalendarContent() {
  const calendar = L1_JULY26_HUSTLER_CALENDAR;
  const { registration, submit, isSubmitted, submitting } = useL1Registration();
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>(
    () => getL1HustlerSlot() ?? JULY26_DEFAULT_SLOT,
  );
  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => {
    if (registration?.slotId) {
      setSelectedSlot(registration.slotId);
    } else if (!selectedSlot && JULY26_DEFAULT_SLOT) {
      setSelectedSlot(JULY26_DEFAULT_SLOT);
    }
  }, [registration?.slotId, selectedSlot]);

  function openRegister() {
    if (!selectedSlot || isSubmitted) return;
    setRegisterOpen(true);
  }

  async function handleSubmit(record: L1RegistrationRecord) {
    return submit(record);
  }

  function handleComplete(record: L1RegistrationRecord) {
    syncL1HustlerSlotFromRegistration(record);
    if (record.slotId) {
      setSelectedSlot(record.slotId);
    }
  }

  return (
    <>
      <IrpCard className="overflow-hidden p-0">
        <div
          className="border-b border-[rgba(103,65,217,0.1)] px-5 py-4 sm:px-6"
          style={{ background: "linear-gradient(130deg, #eef2ff, #f8f0ff)" }}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff9db] text-[#e67700]">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted2">
                {calendar.subtitle}
              </p>
              <h2 className="font-display text-xl font-extrabold text-ink">{calendar.title}</h2>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[rgba(103,65,217,0.12)] bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted2">
                <Calendar className="h-3.5 w-3.5 text-brand" />
                Date
              </div>
              <p className="mt-1 text-sm font-bold text-ink">{calendar.dateLabel}</p>
            </div>
            <div className="rounded-xl border border-[rgba(103,65,217,0.12)] bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted2">
                <Clock className="h-3.5 w-3.5 text-brand" />
                Duration
              </div>
              <p className="mt-1 text-sm font-bold text-ink">{calendar.duration}</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted2">
              <Clock className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              Your slot
            </p>
            <div className="flex flex-wrap gap-2">
              {calendar.slots.map((slot) => {
                const selected = selectedSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={isSubmitted}
                    onClick={() => setSelectedSlot(slot.id)}
                    className={
                      selected
                        ? "rounded-xl border-2 border-[#3b5bdb] bg-[#eef2ff] px-4 py-2.5 text-sm font-bold text-[#3b5bdb]"
                        : "rounded-xl border-2 border-[#dee2e6] bg-white px-4 py-2.5 text-sm font-semibold text-muted2 transition-colors hover:border-[#3b5bdb]/40 disabled:cursor-default disabled:opacity-70"
                    }
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isSubmitted ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-[rgba(12,166,120,0.35)] bg-[#e8faf0] px-5 py-2.5 text-sm font-bold text-teal">
                <CheckCircle2 className="h-4 w-4" />
                Submitted
              </span>
            ) : (
              <button
                type="button"
                disabled={!selectedSlot}
                onClick={openRegister}
                className="btn-pop rounded-xl px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Book · Register for slot
              </button>
            )}
            {!isSubmitted && !selectedSlot ? (
              <span className="text-sm font-medium text-muted2">Select a slot, then complete registration.</span>
            ) : null}
          </div>

          {registration ? <L1RegistrationSuccess record={registration} calendar={calendar} /> : null}

          <p className="text-xs text-muted2">
            The assessment link will be shared on exam day via the Assessments Hub. Attempt the mock assessment before
            the Hustler exam.
          </p>
        </div>
      </IrpCard>

      <L1RegistrationModal
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        slotId={selectedSlot}
        calendar={calendar}
        submitting={submitting}
        onSubmit={handleSubmit}
        onComplete={handleComplete}
      />
    </>
  );
}

function SlotConfirmedContent({ registration }: { registration: L1RegistrationRecord | null }) {
  const calendar = L1_JULY26_HUSTLER_CALENDAR;
  const bookedSlotId = registration?.slotId ?? JULY26_DEFAULT_SLOT;
  const bookedRecord: L1RegistrationRecord =
    registration?.availability === "yes" && registration.slotId
      ? registration
      : {
          availability: "yes",
          slotId: bookedSlotId,
          submittedAt: new Date().toISOString(),
        };

  return (
    <IrpCard className="overflow-hidden p-0">
      <div
        className="border-b border-[rgba(12,166,120,0.2)] px-5 py-4 sm:px-6"
        style={{ background: "linear-gradient(130deg, #e8faf0, #f3f0ff)" }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-teal shadow-sm">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">
              Registration confirmed
            </p>
            <h2 className="font-display text-xl font-extrabold text-ink">
              Slot booked for {calendar.dateLabel}
            </h2>
            <p className="mt-1 text-sm text-muted2">
              Your assessment registration is confirmed for 26th July 2026.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[rgba(103,65,217,0.12)] bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted2">
              <Calendar className="h-3.5 w-3.5 text-brand" />
              Date
            </div>
            <p className="mt-1 text-sm font-bold text-ink">{calendar.dateLabel}</p>
          </div>
          <div className="rounded-xl border border-[rgba(103,65,217,0.12)] bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted2">
              <Clock className="h-3.5 w-3.5 text-brand" />
              Duration
            </div>
            <p className="mt-1 text-sm font-bold text-ink">{calendar.duration}</p>
          </div>
        </div>

        <L1RegistrationSuccess record={bookedRecord} calendar={calendar} />

        <p className="text-xs text-muted2">
          The assessment link will be shared on exam day via the Assessments Hub.
        </p>
      </div>
    </IrpCard>
  );
}

export function BookSlot({ assessments = [] }: { assessments?: AssessmentResult[] }) {
  const { registration } = useL1Registration();
  const slotBooked = hasSuccessfulSlotRegistration(registration);
  const cleared = isCycle1Cleared(assessments);
  const isCandidate = isCycle2Candidate(assessments);
  const registrationOpen = isL1July26RegistrationOpen();

  const showCalendar = isCandidate && !cleared;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Assessment Calendar</h1>
        <p className="mt-1 text-sm text-muted2">
          {slotBooked
            ? `Your slot for the assessment on ${L1_JULY26_EXAM_DATE_LABEL} (6:00 PM – 8:00 PM IST) is confirmed.`
            : showCalendar && registrationOpen
              ? `Choose your slot for the assessment on ${L1_JULY26_EXAM_DATE_LABEL} (6:00 PM – 8:00 PM IST), then complete registration.`
              : cleared
                ? "You cleared the L1 assessment and are on the post-assessment track."
                : "Slot registration will appear here when it opens."}
        </p>
      </div>

      {slotBooked ? (
        <SlotConfirmedContent registration={registration} />
      ) : showCalendar ? (
        <AssessmentCalendarContent />
      ) : (
        <ComingSoonPanel
          title={cleared ? "You're on the post-assessment track" : "Assessment calendar — coming soon"}
          description={
            cleared
              ? "You cleared the L1 assessment. Continue with the next steps from the dashboard or Assessments Hub."
              : "Registration is not open for you yet. Check back for updates."
          }
        />
      )}
    </div>
  );
}
