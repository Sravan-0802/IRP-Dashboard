import { useState } from "react";
import { Calendar, Clock, Trophy, CheckCircle2 } from "lucide-react";
import { IrpCard } from "@/components/irp/ui";
import { ComingSoonPanel } from "@/components/irp/ComingSoonPanel";
import { L1AssessmentBanner } from "@/components/irp/L1AssessmentBanner";
import { L1RegistrationModal, L1RegistrationSuccess } from "@/components/irp/L1RegistrationModal";
import {
  L1_ASSESSMENT_CALENDAR_VISIBLE,
  L1_HUSTLER_CALENDAR,
  getL1HustlerSlot,
  loadL1Registration,
  type L1RegistrationRecord,
} from "@/lib/l1AssessmentSchedule";

function AssessmentCalendarContent() {
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>(getL1HustlerSlot);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registration, setRegistration] = useState<L1RegistrationRecord | null>(loadL1Registration);

  const selectedLabel = L1_HUSTLER_CALENDAR.slots.find((s) => s.id === selectedSlot)?.label;

  function openRegister() {
    if (!selectedSlot) return;
    setRegisterOpen(true);
  }

  function handleComplete(record: L1RegistrationRecord) {
    setRegistration(record);
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
                {L1_HUSTLER_CALENDAR.subtitle} · {L1_HUSTLER_CALENDAR.cycleLabel}
              </p>
              <h2 className="font-display text-xl font-extrabold text-ink">{L1_HUSTLER_CALENDAR.title}</h2>
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
              <p className="mt-1 text-sm font-bold text-ink">{L1_HUSTLER_CALENDAR.dateLabel}</p>
            </div>
            <div className="rounded-xl border border-[rgba(103,65,217,0.12)] bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted2">
                <Clock className="h-3.5 w-3.5 text-brand" />
                Duration
              </div>
              <p className="mt-1 text-sm font-bold text-ink">{L1_HUSTLER_CALENDAR.duration}</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted2">
              <Clock className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              Choose your slot
            </p>
            <div className="flex flex-wrap gap-2">
              {L1_HUSTLER_CALENDAR.slots.map((slot) => {
                const selected = selectedSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlot(slot.id)}
                    className={
                      selected
                        ? "rounded-xl border-2 border-[#3b5bdb] bg-[#eef2ff] px-4 py-2.5 text-sm font-bold text-[#3b5bdb]"
                        : "rounded-xl border-2 border-[#dee2e6] bg-white px-4 py-2.5 text-sm font-semibold text-muted2 transition-colors hover:border-[#3b5bdb]/40"
                    }
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!selectedSlot}
              onClick={openRegister}
              className="btn-pop rounded-xl px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Book · Register for slot
            </button>
            {!selectedSlot ? (
              <span className="text-sm font-medium text-muted2">Select a slot, then complete registration.</span>
            ) : null}
          </div>

          {registration ? <L1RegistrationSuccess record={registration} /> : null}

          {selectedLabel && registration?.availability === "yes" ? (
            <div className="flex items-center gap-2 rounded-xl border border-[rgba(12,166,120,0.25)] bg-[#e8faf0] px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-teal" />
              <p className="text-sm font-semibold text-teal">
                Slot reserved: <span className="font-bold">{selectedLabel}</span> on {L1_HUSTLER_CALENDAR.dateLabel}
              </p>
            </div>
          ) : null}

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
        onComplete={handleComplete}
      />
    </>
  );
}

export function BookSlot() {
  return (
    <div className="space-y-6">
      <L1AssessmentBanner />

      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Assessment Calendar</h1>
        <p className="mt-1 text-sm text-muted2">
          {L1_ASSESSMENT_CALENDAR_VISIBLE
            ? "Choose your slot for the L1 Hustler assessment, then complete the registration form."
            : "Slot registration for the next assessment cycle will appear here when it opens."}
        </p>
      </div>

      {L1_ASSESSMENT_CALENDAR_VISIBLE ? (
        <AssessmentCalendarContent />
      ) : (
        <ComingSoonPanel
          title="Assessment calendar — coming soon"
          description="Cycle 2 online assessment registration is closed. The next cycle's dates and slots will be published here. Cleared students can continue with IRP 2.0 FE Project Main II from the dashboard or Assessments Hub."
        />
      )}
    </div>
  );
}
