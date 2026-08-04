import { useState } from "react";
import { Calendar, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { L1RegistrationModal } from "@/components/irp/L1RegistrationModal";
import { useRegistrationBatch } from "@/lib/useRegistrationBatch";
import { getAuthToken } from "@/lib/authToken";
import type { L1AssessmentCalendar, L1RegistrationRecord } from "@/lib/l1AssessmentSchedule";

async function submitBatchRegistration(
  record: L1RegistrationRecord,
  batchId: number,
): Promise<L1RegistrationRecord> {
  const token = getAuthToken();
  const res = await fetch("/api/student/l1-registration", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      batchId,
      availability: record.availability,
      slotId: record.slotId,
      understandsGc: record.understandsGc,
      willAttend: record.willAttend,
      unavailabilityReason: record.unavailabilityReason,
      notifyNextCycle: record.notifyNextCycle,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Registration failed. Please try again.");
  }
  return record;
}

export function RegistrationBatchCallout() {
  const { batch, hasResponded, loading, refetch } = useRegistrationBatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (loading || !batch) return null;

  const alreadyDone = hasResponded || submitted;

  const calendar: L1AssessmentCalendar = {
    id: `batch-${batch.id}`,
    title: batch.assessmentLabel,
    subtitle: "Registration",
    cycleLabel: "Batch Registration",
    dateLabel: batch.assessmentDate,
    duration: batch.slotLabel ?? "TBD",
    slots: batch.slotId && batch.slotLabel
      ? [{ id: batch.slotId, label: batch.slotLabel }]
      : [],
  };

  async function handleSubmit(record: L1RegistrationRecord): Promise<L1RegistrationRecord | void> {
    const saved = await submitBatchRegistration(record, batch!.id);
    return saved;
  }

  function handleComplete(_record: L1RegistrationRecord) {
    setSubmitted(true);
    void refetch();
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-[rgba(103,65,217,0.2)] bg-gradient-to-br from-[#f3f0ff] via-white to-[#eef2ff] p-5 shadow-[0_8px_32px_-12px_rgba(103,65,217,0.25)]">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[rgba(103,65,217,0.12)] blur-2xl" />
        <div className="pointer-events-none absolute -bottom-4 left-1/3 h-16 w-24 rounded-full bg-[rgba(59,91,219,0.08)] blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6741d9] text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-[rgba(103,65,217,0.2)] bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6741d9]">
                Registration Open
              </div>
              <h3 className="font-display text-lg font-extrabold text-[#0d1117]">
                {batch.assessmentLabel}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[#6e6a8a]">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[#6741d9]" />
                  {batch.assessmentDate}
                </span>
                {batch.slotLabel ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[#6741d9]" />
                    {batch.slotLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="sm:shrink-0">
            {alreadyDone ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-[rgba(12,166,120,0.3)] bg-[#e8faf0] px-4 py-2.5 text-sm font-bold text-[#0ca678]">
                <CheckCircle2 className="h-4 w-4" />
                Registered ✓
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="btn-pop rounded-xl px-5 py-2.5 text-sm font-bold shadow-[0_6px_20px_-6px_rgba(103,65,217,0.55)]"
              >
                Register for assessment
              </button>
            )}
          </div>
        </div>

        {alreadyDone ? (
          <p className="relative mt-3 text-xs font-semibold text-[#6e6a8a]">
            Your response has been recorded. You can update it before the deadline.
          </p>
        ) : (
          <p className="relative mt-3 text-xs font-semibold text-[#6e6a8a]">
            You've been selected for this assessment. Confirm your availability to register.
          </p>
        )}
      </div>

      <L1RegistrationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        slotId={batch.slotId ?? undefined}
        calendar={calendar}
        onSubmit={handleSubmit}
        onComplete={handleComplete}
      />
    </>
  );
}
