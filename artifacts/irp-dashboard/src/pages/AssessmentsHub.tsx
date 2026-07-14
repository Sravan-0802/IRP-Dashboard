import { useState } from "react";
import { ClipboardList, FlaskConical, Trophy, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import type { AssessmentResult } from "@workspace/api-client-react";
import { IrpCard, Pill } from "@/components/irp/ui";
import { L1RegistrationModal } from "@/components/irp/L1RegistrationModal";
import { LEVEL_META, type Journey } from "@/lib/journey";
import {
  hasClearedAssessment,
  hasWrittenAssessment,
} from "@/lib/assessment";
import {
  ASSESSMENT_STATUS_STORAGE_KEY,
  L1_JULY12_HUSTLER_CALENDAR,
  L1_JULY12_HUSTLER_SLOTS,
  L1_MOCK_ASSESSMENT_URL,
  L1_JULY12_MAIN_URL,
  L1_HUSTLER_MAIN_URLS,
  L1_JULY12_REGISTERED_HUB_NOTE,
  l1HustlerSlotLabel,
  hasSuccessfulSlotRegistration,
  syncL1HustlerSlotFromRegistration,
  type L1RegistrationRecord,
} from "@/lib/l1AssessmentSchedule";
import {
  L1_JULY12_EXAM_DATE_LABEL,
  L1_JULY12_REGISTRATION_CLOSE_DATE_LABEL,
  L1_JULY12_REGISTRATION_OPEN_DATE_LABEL,
  isL1July12RegistrationOpen,
  hasL1July12RegistrationStarted,
  isL1July12MockLinkOpen,
  isL1July12MainLinkOpen,
} from "@/lib/irpDates";
import { isCycle1Cleared, shouldShowJuly12SlotCalendar } from "@/lib/l1StudentTrack";
import { useL1Registration } from "@/lib/useL1Registration";
import { useL1ExamAccess } from "@/lib/useL1ExamAccess";
import { useL1July12Cohort } from "@/lib/useL1July12Cohort";
import { trackDashboardEvent, DASHBOARD_ANALYTICS_EVENTS } from "@/lib/analytics";

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
  slots?: readonly SlotConfig[];
}

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
    },
    {
      id: "l1-hustler",
      title: "L1 Hustler",
      description: "The official Level 1 assessment. Pick a slot and give it your best shot.",
      kind: "main",
      slots: L1_JULY12_HUSTLER_SLOTS,
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
  slotRegistrationSubmitted = false,
  registrationClosed = false,
  registrationClosedNote,
  examMainUrl,
  examMainSlotLabel,
  examMainPendingNote,
  mockLinkOpen = false,
  mainLinkOpen = false,
}: {
  config: AssessmentConfig;
  state: { status: AssessmentStatus; slot?: string };
  onUpdate: (next: { status: AssessmentStatus; slot?: string }) => void;
  onBook?: () => void;
  slotRegistrationSubmitted?: boolean;
  registrationClosed?: boolean;
  registrationClosedNote?: string;
  /** Slot-specific MAIN assessment URL — only set on exam day for students with exam access. */
  examMainUrl?: string;
  /** Confirmed slot label for a student with exam access (drives the main card). */
  examMainSlotLabel?: string;
  /** Note shown when a student has exam access but the main link isn't live yet. */
  examMainPendingNote?: string;
  /** Whether the mock link window is currently open (11 Jul 2 PM – 12 Jul 10 AM IST). */
  mockLinkOpen?: boolean;
  /** Whether the main assessment link window is currently open (12 Jul 6 PM – 8 PM IST). */
  mainLinkOpen?: boolean;
}) {
  const { status, slot } = state;
  const Icon = config.kind === "mock" ? FlaskConical : Trophy;
  const needsSlot = (config.slots?.length ?? 0) > 0 && !registrationClosed;
  const assessmentUrl = resolveAssessmentUrl(config, slot);
  const canStart = (!needsSlot || !!slot) && !!assessmentUrl;
  // Exam-access rendering path for the MAIN card.
  const isExamMain = config.kind === "main" && !!examMainSlotLabel && status !== "done";
  // Exam-access rendering path for the MOCK card — always show link/state for
  // cohort/exam-access students regardless of prior mock status.
  const isExamMock = config.kind === "mock" && !!assessmentUrl && !!examMainSlotLabel;

  function openExamMain() {
    if (!examMainUrl) return;
    trackDashboardEvent(DASHBOARD_ANALYTICS_EVENTS.MAIN_ASSESSMENT_LINK_CLICK);
    window.open(examMainUrl, "_blank", "noopener,noreferrer");
    if (status === "todo") onUpdate({ status: "in-progress", slot });
  }

  function openExamMock() {
    if (!assessmentUrl) return;
    trackDashboardEvent(DASHBOARD_ANALYTICS_EVENTS.MOCK_ASSESSMENT_LINK_CLICK);
    window.open(assessmentUrl, "_blank", "noopener,noreferrer");
  }

  function openAssessment() {
    const url = resolveAssessmentUrl(config, slot);
    if (!url) return;
    trackDashboardEvent(
      config.kind === "mock"
        ? DASHBOARD_ANALYTICS_EVENTS.MOCK_ASSESSMENT_LINK_CLICK
        : DASHBOARD_ANALYTICS_EVENTS.MAIN_ASSESSMENT_LINK_CLICK,
    );
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
            {config.kind === "mock" && !resolveAssessmentUrl(config, undefined) && !isExamMock && (
              <p className="mt-2 text-xs font-semibold text-muted2">Mock Assessment link will be updated soon.</p>
            )}
          </div>
        </div>
        {isExamMock ? null : statusPill(status, config.kind)}
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
                  disabled={status === "in-progress" || slotRegistrationSubmitted}
                  onClick={() => onUpdate({ status, slot: s.id })}
                  className={
                    selected
                      ? "rounded-xl border-2 border-[#3b5bdb] bg-[#eef2ff] px-4 py-2 text-sm font-bold text-[#3b5bdb]"
                      : "rounded-xl border-2 border-[#dee2e6] bg-white px-4 py-2 text-sm font-semibold text-muted2 transition-colors hover:border-[#3b5bdb]/40 disabled:cursor-default disabled:opacity-70"
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

      {isExamMain && (
        <p className="mt-4 text-sm font-semibold text-muted2">Stay tuned for next updates.</p>
      )}

      {!isExamMain && registrationClosed && config.kind === "main" && status !== "done" && registrationClosedNote ? (
        <p className="mt-4 text-sm text-muted2">{registrationClosedNote}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {isExamMock ? (
          <p className="text-sm font-semibold text-muted2">Stay tuned for next updates.</p>
        ) : null}
        {status === "todo" && config.kind === "main" && needsSlot && onBook && slotRegistrationSubmitted ? (
          <span className="inline-flex items-center gap-2 rounded-xl border border-[rgba(12,166,120,0.35)] bg-[#e8faf0] px-4 py-2.5 text-sm font-bold text-teal">
            <CheckCircle2 className="h-4 w-4" />
            Submitted
          </span>
        ) : null}
        {status === "todo" && config.kind === "main" && needsSlot && onBook && !slotRegistrationSubmitted ? (
          <button
            type="button"
            disabled={!slot}
            onClick={onBook}
            className="btn-pop flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Book · Register for slot
          </button>
        ) : null}
        {status === "todo" && config.kind !== "main" && !isExamMock && canStart && (
          <button
            type="button"
            onClick={openAssessment}
            className="btn-pop flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
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
        {status === "todo" && needsSlot && !slot && !slotRegistrationSubmitted && (
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
        {status === "done" && !isExamMock && (
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
  const { registration, submit, isSubmitted, submitting } = useL1Registration();
  const { examAccess } = useL1ExamAccess();
  const { registered: july12Registered, registrationUnlocked } = useL1July12Cohort();
  const hustlerState = statuses["l1-hustler"] ?? {
    status: "todo" as AssessmentStatus,
    slot: L1_JULY12_HUSTLER_SLOTS[0]?.id,
  };
  const showJuly12SlotCalendar = shouldShowJuly12SlotCalendar(
    assessments,
    july12Registered,
    hasSuccessfulSlotRegistration(registration),
    registrationUnlocked,
  );
  const july12RegistrationOpen = isL1July12RegistrationOpen() || registrationUnlocked;
  const mockLinkOpen = isL1July12MockLinkOpen();
  const mainLinkOpen = isL1July12MainLinkOpen();

  const assessmentsForLevel = ASSESSMENTS_BY_LEVEL[level];
  const meta = LEVEL_META[level];

  // Cohort members (july12Registered) OR students in the DB exam-access list get
  // the mock + main links. The July 12 re-conduction has a single common main link.
  const hasExamAccess = level === 1 && (!!examAccess || july12Registered);
  const examSlotId = examAccess?.slotId ?? (july12Registered ? "slot-2" : undefined);
  const examMainUrl = hasExamAccess ? (july12Registered ? L1_JULY12_MAIN_URL : (examSlotId ? L1_HUSTLER_MAIN_URLS[examSlotId] : undefined)) : undefined;
  const examMainSlotLabel = hasExamAccess ? (july12Registered ? "6:00 PM – 8:00 PM IST" : l1HustlerSlotLabel(examSlotId)) : undefined;

  function update(id: string, next: { status: AssessmentStatus; slot?: string }) {
    setStatuses((prev) => {
      const map = { ...prev, [id]: next };
      saveStatuses(map);
      return map;
    });
  }

  async function handleRegistrationSubmit(record: L1RegistrationRecord) {
    return submit(record);
  }

  function handleRegistrationComplete(record: L1RegistrationRecord) {
    syncL1HustlerSlotFromRegistration(record);
    if (record.slotId) {
      update("l1-hustler", { status: "todo", slot: record.slotId });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Assessments Hub</h1>
        <p className="mt-1 text-sm text-muted2">
          {level === 1 && july12Registered
            ? `Already registered for ${L1_JULY12_EXAM_DATE_LABEL}. Your 6:00 PM – 8:00 PM IST slot is booked — details will appear closer to the exam.`
            : level === 1 && isCycle1Cleared(assessments)
            ? "You cleared the 14 June assessment. Your FE Project status is shown on your dashboard."
            : level === 1
              ? `Attempting Mock Assessment is Mandatory. Your Assessment link will be functional from 6:00 PM – 8:00 PM IST on 12th July 2026.`
              : `Your ${meta.name} assessments — attempt the mock first, then register for the Hustler assessment.`}
        </p>
      </div>

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
          {assessmentsForLevel.map((a) => {
            // Inject the COMMON mock link for students who are on the exam-platform list.
            const config =
              a.id === "l1-mock" && hasExamAccess ? { ...a, url: L1_MOCK_ASSESSMENT_URL } : a;
            const derived = deriveAssessmentState(a, assessments, level, statuses[a.id] ?? { status: "todo" });
            // The common mock link must stay startable for exam-access students even
            // if they already wrote the earlier (cycle-1) assessment, which would
            // otherwise mark the mock "done". Fall back to their local mock state.
            const state =
              a.id === "l1-mock" && hasExamAccess && derived.status === "done"
                ? statuses[a.id] ?? { status: "todo" as AssessmentStatus }
                : derived;
            return (
            <AssessmentCard
              key={a.id}
              config={config}
              state={state}
              onUpdate={(next) => update(a.id, next)}
              examMainUrl={a.id === "l1-hustler" ? examMainUrl : undefined}
              examMainSlotLabel={examMainSlotLabel}
              mockLinkOpen={mockLinkOpen}
              mainLinkOpen={mainLinkOpen}
              examMainPendingNote={
                a.id === "l1-hustler"
                  ? `Your L1 Hustler assessment link will be available here on exam day (${L1_JULY12_EXAM_DATE_LABEL}).`
                  : undefined
              }
              onBook={undefined}
              slotRegistrationSubmitted={false}
              registrationClosed={a.id === "l1-hustler"}
              registrationClosedNote={
                a.id === "l1-hustler" && july12Registered
                  ? L1_JULY12_REGISTERED_HUB_NOTE
                  : a.id === "l1-hustler" && isCycle1Cleared(assessments)
                  ? "You cleared the 14 June assessment. Your FE Project status is shown on your dashboard."
                  : a.id === "l1-hustler"
                  ? `Registration for the ${L1_JULY12_EXAM_DATE_LABEL} assessment is now closed.`
                  : undefined
              }
            />
            );
          })}
        </div>
      )}

      <L1RegistrationModal
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        slotId={hustlerState.slot ?? L1_JULY12_HUSTLER_SLOTS[0]?.id}
        calendar={L1_JULY12_HUSTLER_CALENDAR}
        submitting={submitting}
        onSubmit={handleRegistrationSubmit}
        onComplete={handleRegistrationComplete}
      />
    </div>
  );
}
