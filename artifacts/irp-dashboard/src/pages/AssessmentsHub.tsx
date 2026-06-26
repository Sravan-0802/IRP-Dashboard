import { useState } from "react";
import { ClipboardList, FlaskConical, Trophy, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import { IrpCard, Pill } from "@/components/irp/ui";
import { L1AssessmentBanner } from "@/components/irp/L1AssessmentBanner";
import { L1RegistrationModal } from "@/components/irp/L1RegistrationModal";
import { FeProjectCallout } from "@/components/irp/FeProjectCallout";
import { LEVEL_META, type Journey } from "@/lib/journey";
import {
  hasClearedAssessment,
  hasWrittenAssessment,
} from "@/lib/assessment";
import {
  ASSESSMENT_STATUS_STORAGE_KEY,
  L1_ASSESSMENT_CALENDAR_VISIBLE,
  L1_HUSTLER_SLOTS,
  type L1RegistrationRecord,
} from "@/lib/l1AssessmentSchedule";

// ── Config ───────────────────────────────────────────────────────────────────
// Per-level assessments. Add L2/L3 entries here when those levels go live.

export type AssessmentStatus = "todo" | "in-progress" | "done";

interface SlotConfig {
  id: string;
  label: string;
  /** Per-slot assessment URL — add when the link is ready. */
  url?: string;
}

interface AssessmentConfig {
  id: string;
  title: string;
  description: string;
  kind: "mock" | "main";
  /** Single assessment URL (used when there are no slots, e.g. mock). */
  url?: string;
  slots?: SlotConfig[];
}

const L1_MOCK_ASSESSMENT_URL =
  "https://config.topin.tech/edit-assessment/77f9f450-9c8b-4205-aa34-78c2fd978f89";

function resolveAssessmentUrl(config: AssessmentConfig, slotId?: string): string | undefined {
  if (slotId && config.slots) {
    return config.slots.find((s) => s.id === slotId)?.url;
  }
  return config.url;
}

const ASSESSMENTS_BY_LEVEL: Record<1 | 2 | 3, AssessmentConfig[]> = {
  1: [
    {
      id: "l1-mock",
      title: "Mock Assessment",
      description: "A practice run that mirrors the real L1 exam format. Attempt it before your Hustler assessment.",
      kind: "mock",
      url: L1_MOCK_ASSESSMENT_URL,
    },
    {
      id: "l1-hustler",
      title: "L1 Hustler",
      description: "The official Level 1 assessment. Pick a slot and give it your best shot.",
      kind: "main",
      slots: L1_HUSTLER_SLOTS,
    },
  ],
  2: [],
  3: [],
};

// ── Status helpers ───────────────────────────────────────────────────────────

type StatusMap = Record<string, { status: AssessmentStatus; slot?: string }>;

function loadStatuses(): StatusMap {
  try {
    return JSON.parse(localStorage.getItem(ASSESSMENT_STATUS_STORAGE_KEY) ?? "{}") as StatusMap;
  } catch {
    return {};
  }
}

function saveStatuses(map: StatusMap) {
  localStorage.setItem(ASSESSMENT_STATUS_STORAGE_KEY, JSON.stringify(map));
}

function deriveAssessmentState(
  config: AssessmentConfig,
  assessments: AssessmentResult[],
  level: 1 | 2 | 3,
  local: { status: AssessmentStatus; slot?: string },
): { status: AssessmentStatus; slot?: string } {
  const written = hasWrittenAssessment(assessments, level);
  const cleared = hasClearedAssessment(assessments, level);
  const defaultSlot = config.slots?.[0]?.id;

  if (config.kind === "main") {
    if (cleared) return { status: "done", slot: local.slot ?? defaultSlot };
    if (written) return { status: "in-progress", slot: local.slot ?? defaultSlot };
    return local;
  }

  if (written || cleared) {
    return { status: "done", slot: local.slot ?? defaultSlot };
  }

  return local;
}

function statusPill(status: AssessmentStatus, _kind: "mock" | "main") {
  if (status === "done") return <Pill tone="green"><CheckCircle2 className="h-3 w-3" /> Done</Pill>;
  return null;
}

// ── Components ───────────────────────────────────────────────────────────────

function AssessmentCard({
  config,
  state,
  onUpdate,
  onBook,
  registrationClosed = false,
}: {
  config: AssessmentConfig;
  state: { status: AssessmentStatus; slot?: string };
  onUpdate: (next: { status: AssessmentStatus; slot?: string }) => void;
  onBook?: () => void;
  registrationClosed?: boolean;
}) {
  const { status, slot } = state;
  const Icon = config.kind === "mock" ? FlaskConical : Trophy;
  const needsSlot = (config.slots?.length ?? 0) > 0 && !registrationClosed;
  const assessmentUrl = resolveAssessmentUrl(config, slot);
  const canStart = (!needsSlot || !!slot) && !!assessmentUrl;

  function openAssessment() {
    const url = resolveAssessmentUrl(config, slot);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    if (status === "todo") {
      onUpdate({ status: "in-progress", slot });
    }
  }

  return (
    <IrpCard className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={
              config.kind === "mock"
                ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3b5bdb]"
                : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff9db] text-[#e67700]"
            }
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-extrabold text-ink">{config.title}</h3>
            <p className="mt-1 text-sm text-muted2">{config.description}</p>
          </div>
        </div>
        {statusPill(status, config.kind)}
      </div>

      {needsSlot && status !== "done" && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted2">
            <Clock className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            Choose your slot
          </p>
          <div className="flex flex-wrap gap-2">
            {config.slots!.map((s) => {
              const selected = slot === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={status === "in-progress"}
                  onClick={() => onUpdate({ status, slot: s.id })}
                  className={
                    selected
                      ? "rounded-xl border-2 border-[#3b5bdb] bg-[#eef2ff] px-4 py-2 text-sm font-bold text-[#3b5bdb]"
                      : "rounded-xl border-2 border-[#dee2e6] bg-white px-4 py-2 text-sm font-semibold text-muted2 transition-colors hover:border-[#3b5bdb]/40 disabled:opacity-50"
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {needsSlot && status === "done" && slot && (
        <p className="mt-4 text-xs font-semibold text-muted2">
          Attempted in the {config.slots!.find((s) => s.id === slot)?.label} slot.
        </p>
      )}

      {registrationClosed && config.kind === "main" && status !== "done" ? (
        <p className="mt-4 text-sm text-muted2">
          Slot registration is closed for this cycle. The Assessment Calendar will reopen for the next
          cycle — coming soon.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {status === "todo" && config.kind === "main" && needsSlot && onBook ? (
          <button
            type="button"
            disabled={!slot}
            onClick={onBook}
            className="btn-pop flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Book · Register for slot
          </button>
        ) : null}
        {status === "todo" && config.kind !== "main" && (
          <button
            type="button"
            disabled={!canStart}
            onClick={openAssessment}
            className="btn-pop flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed"
          >
            <ExternalLink className="h-4 w-4" />
            {config.kind === "mock" ? "Start Mock Assessment" : "Start Assessment"}
          </button>
        )}
        {status === "todo" && config.kind === "main" && needsSlot && !onBook && (
          <button
            type="button"
            disabled={!canStart}
            onClick={openAssessment}
            className="btn-pop flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed"
          >
            <ExternalLink className="h-4 w-4" />
            Start Assessment
          </button>
        )}
        {status === "todo" && needsSlot && !slot && (
          <span className="text-xs font-semibold text-muted2">
            {onBook ? "Select a slot, then click Book to register." : "Select a slot to begin."}
          </span>
        )}
        {status === "todo" && needsSlot && slot && !assessmentUrl && (
          <span className="text-xs font-semibold text-muted2">Assessment link for this slot will be shared soon.</span>
        )}
        {status === "in-progress" && assessmentUrl && (
          <button
            type="button"
            onClick={openAssessment}
            className="btn-pop flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            <ExternalLink className="h-4 w-4" /> Continue Assessment
          </button>
        )}
        {status === "done" && (
          <span className="flex items-center gap-1.5 text-sm font-bold text-[#0ca678]">
            <CheckCircle2 className="h-4 w-4" /> Completed
          </span>
        )}
      </div>
    </IrpCard>
  );
}

export function AssessmentsHub({
  level = 1,
  assessments = [],
  journey,
}: {
  level?: 1 | 2 | 3;
  assessments?: AssessmentResult[];
  journey?: Journey;
}) {
  const [statuses, setStatuses] = useState<StatusMap>(loadStatuses);
  const [registerOpen, setRegisterOpen] = useState(false);
  const hustlerState = statuses["l1-hustler"] ?? { status: "todo" as AssessmentStatus };

  const assessmentsForLevel = ASSESSMENTS_BY_LEVEL[level];
  const meta = LEVEL_META[level];

  function update(id: string, next: { status: AssessmentStatus; slot?: string }) {
    setStatuses((prev) => {
      const map = { ...prev, [id]: next };
      saveStatuses(map);
      return map;
    });
  }

  function handleRegistrationComplete(record: L1RegistrationRecord) {
    if (record.slotId) {
      update("l1-hustler", { status: "todo", slot: record.slotId });
    }
  }

  return (
    <div className="space-y-6">
      {level === 1 ? <L1AssessmentBanner /> : null}

      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Assessments Hub</h1>
        <p className="mt-1 text-sm text-muted2">
          {L1_ASSESSMENT_CALENDAR_VISIBLE
            ? `Your ${meta.name} assessments — attempt the mock first, then register for the Hustler assessment.`
            : `Your ${meta.name} assessments — cleared the online exam? Complete IRP 2.0 FE Project Main II below.`}
        </p>
      </div>

      {level === 1 && journey ? (
        <FeProjectCallout journey={journey} assessments={assessments} className="mt-0" />
      ) : null}

      {assessmentsForLevel.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[rgba(103,65,217,0.1)] bg-[rgba(103,65,217,0.03)] py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-l1-bg text-l1">
            <ClipboardList className="h-5 w-5" />
          </div>
          <p className="font-display text-base font-extrabold text-ink">No assessments yet</p>
          <p className="max-w-xs text-sm text-muted2">
            Assessments for {meta.name} will appear here once they are scheduled.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {assessmentsForLevel.map((a) => (
            <AssessmentCard
              key={a.id}
              config={a}
              state={deriveAssessmentState(a, assessments, level, statuses[a.id] ?? { status: "todo" })}
              onUpdate={(next) => update(a.id, next)}
              onBook={
                a.id === "l1-hustler" && L1_ASSESSMENT_CALENDAR_VISIBLE
                  ? () => setRegisterOpen(true)
                  : undefined
              }
              registrationClosed={a.id === "l1-hustler" && !L1_ASSESSMENT_CALENDAR_VISIBLE}
            />
          ))}
        </div>
      )}

      <L1RegistrationModal
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        slotId={hustlerState.slot}
        onComplete={handleRegistrationComplete}
      />
    </div>
  );
}
