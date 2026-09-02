import { useState } from "react";
import { Clock, CheckCircle2, Sparkles } from "lucide-react";
import { L1RegistrationModal } from "@/components/irp/L1RegistrationModal";
import { useRegistrationBatch } from "@/lib/useRegistrationBatch";
import { getAuthToken } from "@/lib/authToken";
import type { L1AssessmentCalendar, L1RegistrationRecord } from "@/lib/l1AssessmentSchedule";
import {
  resolveRegistrationBatchDate,
} from "@/lib/registrationBatchDisplay";

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
  const { dateLabel, showDateMeta: _showDateMeta } = resolveRegistrationBatchDate(
    batch.assessmentLabel,
    batch.assessmentDate,
  );

  const calendar: L1AssessmentCalendar = {
    id: `batch-${batch.id}`,
    title: batch.assessmentLabel,
    subtitle: "Registration",
    cycleLabel: "Batch Registration",
    dateLabel,
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
      <div
        className="relative overflow-hidden rounded-2xl p-[1.5px]"
        style={{
          background: alreadyDone
            ? "linear-gradient(135deg, rgba(12,166,120,0.4) 0%, rgba(12,166,120,0.15) 100%)"
            : "linear-gradient(135deg, #6741d9 0%, #3b5bdb 60%, #a855f7 100%)",
          boxShadow: alreadyDone
            ? "0 8px 32px -10px rgba(12,166,120,0.2)"
            : "0 8px 40px -12px rgba(103,65,217,0.45)",
        }}
      >
        <div
          className="relative overflow-hidden rounded-[14px] px-5 py-4"
          style={{
            background: alreadyDone
              ? "linear-gradient(135deg, #f0fdf9 0%, #f8f7ff 100%)"
              : "linear-gradient(135deg, #f3f0ff 0%, #eef2ff 60%, #faf8ff 100%)",
          }}
        >
          {/* Decorative blobs */}
          {!alreadyDone && (
            <>
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl"
                style={{ background: "rgba(103,65,217,0.14)" }}
              />
              <div
                className="pointer-events-none absolute -bottom-6 left-1/4 h-20 w-32 rounded-full blur-3xl"
                style={{ background: "rgba(59,91,219,0.1)" }}
              />
            </>
          )}

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: icon + text */}
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm"
                style={{
                  background: alreadyDone
                    ? "linear-gradient(135deg, #0ca678, #12b886)"
                    : "linear-gradient(135deg, #6741d9, #3b5bdb)",
                }}
              >
                {alreadyDone
                  ? <CheckCircle2 className="h-6 w-6 text-white" />
                  : <Sparkles className="h-6 w-6 text-white" />}
              </div>

              <div>
                {/* Badge */}
                <div className="mb-1.5">
                  {alreadyDone ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                      style={{
                        background: "rgba(12,166,120,0.12)",
                        color: "#0ca678",
                        border: "1px solid rgba(12,166,120,0.25)",
                      }}
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Registered
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                      style={{
                        background: "rgba(103,65,217,0.1)",
                        color: "#6741d9",
                        border: "1px solid rgba(103,65,217,0.2)",
                      }}
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <span
                          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                          style={{ background: "#6741d9" }}
                        />
                        <span
                          className="relative inline-flex h-1.5 w-1.5 rounded-full"
                          style={{ background: "#6741d9" }}
                        />
                      </span>
                      Registration Open
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3
                  className="font-display text-base font-extrabold leading-tight"
                  style={{ color: "#0d1117" }}
                >
                  {batch.assessmentLabel}
                </h3>

                {/* Meta */}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {batch.slotLabel ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: "#6e6a8a" }}
                    >
                      <Clock className="h-3.5 w-3.5" style={{ color: "#6741d9" }} />
                      {batch.slotLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right: CTA */}
            <div className="sm:shrink-0 sm:pl-4">
              {alreadyDone ? (
                <div
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
                  style={{
                    background: "rgba(12,166,120,0.12)",
                    color: "#0ca678",
                    border: "1px solid rgba(12,166,120,0.25)",
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Response recorded ✓
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="btn-pop inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
                  style={{
                    boxShadow: "0 6px 20px -6px rgba(103,65,217,0.55)",
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Register for assessment
                </button>
              )}
            </div>
          </div>

          {/* Bottom note — only for unregistered */}
          {!alreadyDone && (
            <p
              className="relative mt-3 text-xs font-medium"
              style={{ color: "#6e6a8a" }}
            >
              You've been selected for this assessment. Confirm your availability to register.
            </p>
          )}
        </div>
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
