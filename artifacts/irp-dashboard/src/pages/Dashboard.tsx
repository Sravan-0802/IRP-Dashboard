import { useEffect, useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import {
  useGetStudent, getGetStudentQueryKey,
  useGetStudentProgress, getGetStudentProgressQueryKey,
} from "@workspace/api-client-react";
import { EXAM_DATE, EXAM_DATE_LABEL } from "@/lib/irpDates";
import { useJourney } from "@/lib/useJourney";
import { getLevel } from "@/lib/journey";
import { DEMO_STUDENT, DEMO_PROGRESS } from "@/lib/demoData";
import { SidebarContent, type PageKey } from "@/components/irp/Sidebar";
import { SettingsSheet } from "@/components/irp/SettingsSheet";
import { DashboardView } from "@/components/irp/DashboardView";
import { MyLearning } from "./MyLearning";
import { BookSlot } from "./BookSlot";
import type { SubjectRow } from "@/components/irp/ProgressSummary";

export default function Dashboard() {
  const { data: journey, isLoading: loadingJourney } = useJourney();
  const { data: student, isError: studentError } = useGetStudent({
    query: { queryKey: getGetStudentQueryKey(), retry: false },
  });
  const { data: progress, isError: progressError } = useGetStudentProgress({
    query: { queryKey: getGetStudentProgressQueryKey(), retry: false },
  });

  const [page, setPage] = useState<PageKey>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMode, setSettingsMode] = useState<"menu" | "to-standard">("menu");
  const [countdown, setCountdown] = useState({ days: 0 });

  useEffect(() => {
    const tick = () => {
      const dist = EXAM_DATE.getTime() - Date.now();
      if (dist < 0) return setCountdown({ days: 0 });
      setCountdown({
        days: Math.floor(dist / 86_400_000),
      });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const displayStudent = student ?? (studentError ? DEMO_STUDENT : null);
  const displayProgress = progress ?? (progressError ? DEMO_PROGRESS : null);

  const subjects: SubjectRow[] = useMemo(
    () => (Array.isArray(displayProgress?.subjects) ? (displayProgress!.subjects as SubjectRow[]) : []),
    [displayProgress],
  );

  const progressProps = useMemo(() => {
    const mcqDone = subjects.reduce((a, s) => a + s.mcqCompleted, 0);
    const mcqTotal = subjects.reduce((a, s) => a + s.mcqTotal, 0);
    const codingDone = subjects.reduce((a, s) => a + s.codingCompleted, 0);
    const codingTotal = subjects.reduce((a, s) => a + s.codingTotal, 0);
    const mcqPct = displayProgress?.overallMcqPercentage ?? 0;
    const codingPct = displayProgress?.overallCodingPercentage ?? 0;
    return {
      overallPct: Math.round((mcqPct + codingPct) / 2),
      mcqPct,
      codingPct,
      mcqDone,
      mcqTotal,
      codingDone,
      codingTotal,
      points: mcqDone * 5 + codingDone * 10,
      maxPoints: 2000,
      subjects,
    };
  }, [subjects, displayProgress]);

  if (loadingJourney || !journey || !displayStudent) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <p className="text-sm font-semibold text-muted2">Loading your dashboard…</p>
      </div>
    );
  }

  const firstName = displayStudent.name.split(" ")[0];

  function openSwitchToStandard() {
    setSettingsMode("to-standard");
    setSettingsOpen(true);
  }
  function openSettings() {
    setSettingsMode("menu");
    setSettingsOpen(true);
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <aside className="glass-panel hidden w-[220px] shrink-0 border-r border-[rgba(103,65,217,0.1)] shadow-[2px_0_20px_rgba(103,65,217,0.05)] md:flex">
        <SidebarContent
          name={displayStudent.name}
          yog={displayStudent.yog}
          journey={journey}
          active={page}
          onNavigate={setPage}
          onOpenSettings={openSettings}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[110] md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-[rgba(13,17,23,0.35)] backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[min(280px,85vw)] border-r border-[rgba(103,65,217,0.1)] bg-[rgba(255,255,255,0.96)] backdrop-blur-xl">
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted2">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              name={displayStudent.name}
              yog={displayStudent.yog}
              journey={journey}
              active={page}
              onNavigate={(k) => { setPage(k); setMobileOpen(false); }}
              onOpenSettings={() => { setMobileOpen(false); openSettings(); }}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass-bar sticky top-0 z-40 flex items-center gap-3 border-b border-[rgba(103,65,217,0.1)] px-4 py-3 md:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(59,91,219,0.18)] bg-l1-bg text-l1">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-base font-extrabold text-ink">IRP 2.0</span>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16">
          <div className="mx-auto max-w-[1160px] p-4 sm:p-6 lg:p-8">
            {page === "dashboard" && (
              <DashboardView
                journey={journey}
                firstName={firstName}
                days={countdown.days}
                examDateLabel={EXAM_DATE_LABEL}
                progress={progressProps}
                onSwitchToStandard={openSwitchToStandard}
              />
            )}
            {page === "learning" && <MyLearning subjects={subjects} level={getLevel(journey.journeyState)} />}
            {page === "slot" && <BookSlot />}
          </div>
        </main>
      </div>

      <SettingsSheet
        key={settingsMode}
        journey={journey}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialMode={settingsMode}
      />
    </div>
  );
}
