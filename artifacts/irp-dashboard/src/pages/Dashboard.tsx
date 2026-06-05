import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import {
  useGetStudent, getGetStudentQueryKey,
  useGetStudentProgress, getGetStudentProgressQueryKey,
  useGetStudentMarks, getGetStudentMarksQueryKey,
  useGetStudentActivity, getGetStudentActivityQueryKey,
} from '@workspace/api-client-react';
import type { Student } from '@workspace/api-client-react';
import {
  LayoutDashboard, TrendingUp, LogOut, Flame, ChevronDown,
  ArrowRight, Trophy, Clock, Menu, Rocket,
} from 'lucide-react';
import { RadialProgress } from '@/components/ui/radial-progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { IRP_LANDING_URL } from '@/lib/app-links';
import { DEMO_STUDENT, DEMO_PROGRESS, DEMO_ACTIVITY } from '@/lib/demoData';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true, href: '#' },
  { icon: Rocket, label: 'IRP 2.0 Program', active: false, href: IRP_LANDING_URL },
];

function StudentAvatar({ student, className = 'w-10 h-10' }: { student: Student; className?: string }) {
  return (
    <div className={`${className} rounded-full overflow-hidden border-2 border-primary/20 shrink-0 bg-primary/10 flex items-center justify-center`}>
      {student.avatar ? (
        <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-sm font-bold text-primary">
          {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </span>
      )}
    </div>
  );
}

function SidebarContent({ student, onNavigate }: { student: Student; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white/75 backdrop-blur-xl">
      <div className="px-4 pt-4 pb-4 flex items-center border-b border-white/50">
        <img src="/nxtwave-logo.png" alt="NxtWave Academy" className="h-16 md:h-20 w-auto object-contain" style={{ mixBlendMode: 'multiply' }} />
      </div>

      <div className="px-4 py-4 border-b border-white/50">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 border border-white/60 cursor-pointer hover:bg-white/70 transition-colors">
          <StudentAvatar student={student} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-900 truncate">{student.name}</p>
            <p className="text-xs text-gray-500 font-medium">YOG {student.yog}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-bold px-3 py-1.5 bg-primary text-white rounded-lg">
          <span className="truncate">{student.level}</span>
          <Trophy className="w-3.5 h-3.5 shrink-0" />
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ icon: Icon, label, active, href }) => (
          <a
            key={label}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              active
                ? 'bg-primary/10 text-primary'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </a>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/50">
        <button
          type="button"
          onClick={onNavigate}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50/60 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </div>
  );
}

function CircularCountdown({ days, size = 120 }: { days: number; size?: number }) {
  const totalDays = 61;
  const radius = size * 0.383;
  const circumference = 2 * Math.PI * radius;
  const elapsed = Math.max(0, totalDays - days);
  const arcLength = circumference * Math.min(elapsed / totalDays, 1);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Dark background */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: 'radial-gradient(circle at 40% 35%, #252545, #13132a)' }}
      />
      {/* SVG arc */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2e2e4a" strokeWidth={size * 0.075} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={size * 0.075}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - arcLength}
          style={{ filter: 'drop-shadow(0 0 6px #f59e0baa)' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Starts In</span>
        <span className="font-black leading-none text-amber-400" style={{ fontSize: size * 0.3, textShadow: '0 0 16px #f59e0b88' }}>
          {days}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Days</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: student } = useGetStudent({ query: { queryKey: getGetStudentQueryKey() } });
  const { data: progress } = useGetStudentProgress({ query: { queryKey: getGetStudentProgressQueryKey() } });
  const { data: marks } = useGetStudentMarks({ query: { queryKey: getGetStudentMarksQueryKey() } });
  const { data: activity } = useGetStudentActivity({ query: { queryKey: getGetStudentActivityQueryKey() } });

  const displayStudent = student ?? DEMO_STUDENT;
  const displayProgress = progress ?? DEMO_PROGRESS;
  const displayActivity = activity ?? DEMO_ACTIVITY;

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetDate = new Date('2026-06-14T00:00:00').getTime();
    const tick = () => {
      const now = Date.now();
      const distance = targetDate - now;
      if (distance < 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const subjects = Array.isArray(displayProgress.subjects) ? displayProgress.subjects : [];
  const marksList = Array.isArray(marks) ? marks : [];
  const weeklyActivity = Array.isArray(displayActivity.weeklyActivity) ? displayActivity.weeklyActivity : [];

  // Compute MCQ totals
  const totalMcqQuestions = subjects.reduce((a, s) => a + s.mcqTotal, 0);
  const totalMcqAttempted = subjects.reduce((a, s) => a + s.mcqCompleted, 0);
  const totalMcqRemaining = totalMcqQuestions - totalMcqAttempted;

  // Compute Coding totals
  const totalCodingProblems = subjects.reduce((a, s) => a + s.codingTotal, 0);
  const totalCodingSolved = subjects.reduce((a, s) => a + s.codingCompleted, 0);
  const totalCodingRemaining = totalCodingProblems - totalCodingSolved;

  // Compute marks summary
  const mcqMarks = marksList.filter(m => m.category === 'MCQ');
  const codingMarks = marksList.filter(m => m.category === 'Coding');
  const mcqScore = mcqMarks.reduce((a, m) => a + m.score, 0);
  const mcqMax = mcqMarks.reduce((a, m) => a + m.maxScore, 0);
  const codingScore = codingMarks.reduce((a, m) => a + m.score, 0);
  const codingMax = codingMarks.reduce((a, m) => a + m.maxScore, 0);
  const totalScore = mcqScore + codingScore;
  const totalMax = mcqMax + codingMax;
  const mcqPct = mcqMax > 0 ? ((mcqScore / mcqMax) * 100).toFixed(2) : '0.00';
  const codingPct = codingMax > 0 ? ((codingScore / codingMax) * 100).toFixed(2) : '0.00';
  const totalPct = totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(2) : '0.00';

  // Overall progress
  const overallPct = Math.round((displayProgress.overallMcqPercentage + displayProgress.overallCodingPercentage) / 2);

  // Milestone points
  const milestonePoints = displayActivity.totalMcqSolved * 5 + displayActivity.totalCodingSolved * 10;
  const milestoneMax = 2000;

  // Weekly bar chart max
  const weeklyMax = Math.max(...weeklyActivity.map(d => d.mcq + d.coding), 1);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex h-[100dvh] bg-gradient-to-br from-[#ede9fe] via-[#f5f3ff] to-[#dde8ff] text-foreground overflow-hidden">

      {/* ── Desktop Sidebar ── */}
      <aside className="w-60 border-r border-white/60 shrink-0 hidden md:flex shadow-xl">
        <SidebarContent student={displayStudent} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* ── Mobile Header ── */}
        <header className="md:hidden sticky top-0 z-40 flex items-center gap-3 border-b border-white/60 bg-white/85 px-4 py-3 backdrop-blur-xl">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/70 text-gray-700 shadow-sm"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(280px,85vw)] p-0 [&>button]:top-3 [&>button]:right-3">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>Dashboard navigation menu</SheetDescription>
              </SheetHeader>
              <SidebarContent student={displayStudent} onNavigate={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>

          <StudentAvatar student={displayStudent} className="w-9 h-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">{displayStudent.name}</p>
            <p className="truncate text-xs font-medium text-gray-500">YOG {displayStudent.yog}</p>
          </div>
          {displayProgress.streakDays > 0 && (
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-600">
              <Flame className="h-3.5 w-3.5" /> {displayProgress.streakDays}
            </div>
          )}
        </header>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
          <div className="mx-auto max-w-[1100px] space-y-4 p-4 sm:space-y-5 sm:p-6">

          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-black text-gray-900 sm:text-2xl">
                Welcome back, {displayStudent.name.split(' ')[0]}! 👋
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">Let's continue your learning journey and crush the assessment.</p>
            </div>
            {displayProgress.streakDays > 0 && (
              <div className="hidden sm:flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 px-4 py-2 rounded-full font-bold text-sm shrink-0">
                <Flame className="w-4 h-4" /> {displayProgress.streakDays} Day Streak
              </div>
            )}
          </div>

          {/* Assessment Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#5b21b6] via-[#6d28d9] to-[#7c3aed] text-white shadow-lg">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="relative flex flex-col items-center gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8">
              <div className="flex w-full flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left lg:flex-1">
                <div className="text-5xl select-none sm:text-6xl">🚀</div>
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider mb-3 border border-white/20">
                    <Clock className="w-3 h-3" /> Upcoming Assessment
                  </div>
                  <h2 className="text-xl font-black leading-tight sm:text-2xl">Level 1: The Hustler</h2>
                  <p className="text-white/75 text-sm font-medium mt-1">14 June 2026 • IRP Assessment</p>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/60 text-center">Assessment Countdown</p>
                <CircularCountdown days={timeLeft.days} size={isMobile ? 96 : 120} />
              </div>
            </div>
          </div>

          {/* Journey Stepper */}
          <div className="bg-white/70 backdrop-blur-sm border border-white/80 shadow-lg rounded-2xl px-4 py-5 sm:px-6 md:px-8 md:py-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-0 relative">
              <div className="absolute top-7 left-[16.7%] right-[16.7%] hidden h-px border-t-2 border-dashed border-gray-200 md:block z-0" />

              {/* Step 1 — In Progress */}
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center md:w-1/3 relative z-10">
                <div className="relative w-14 h-14 shrink-0 rounded-full bg-white border-2 border-orange-400 flex items-center justify-center md:mb-3 shadow-sm">
                  <span className="text-xl">📋</span>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-400 text-white text-[10px] font-black flex items-center justify-center">1</span>
                </div>
                <div className="min-w-0 flex-1 md:flex-none">
                  <p className="font-bold text-gray-900 text-sm">An Online Assessment</p>
                  <span className="mt-1.5 inline-block px-3 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600">In Progress</span>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">Attempt the online assessment and qualify for Level 2 access.</p>
                </div>
              </div>

              {/* Step 2 — Not Started */}
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center md:w-1/3 relative z-10">
                <div className="relative w-14 h-14 shrink-0 rounded-full bg-white border-2 border-indigo-400 flex items-center justify-center md:mb-3 shadow-sm">
                  <span className="text-xl">👥</span>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-400 text-white text-[10px] font-black flex items-center justify-center">2</span>
                </div>
                <div className="min-w-0 flex-1 md:flex-none">
                  <p className="font-bold text-gray-900 text-sm">Post-Assessment (Level 1)</p>
                  <span className="mt-1.5 inline-block px-3 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-500">Not Started</span>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">Complete projects and mock interviews to unlock Level 2 access.</p>
                </div>
              </div>

              {/* Step 3 — Locked */}
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center md:w-1/3 relative z-10">
                <div className="relative w-14 h-14 shrink-0 rounded-full bg-gray-50 border-2 border-gray-300 flex items-center justify-center md:mb-3 shadow-sm">
                  <span className="text-xl">🔒</span>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-400 text-white text-[10px] font-black flex items-center justify-center">3</span>
                </div>
                <div className="min-w-0 flex-1 md:flex-none">
                  <p className="font-bold text-gray-400 text-sm">Level 2 Access</p>
                  <span className="mt-1.5 inline-block px-3 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-500">Locked</span>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">Unlock advanced tracks, internships and exclusive benefits.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Combined Overall IRP Progress */}
          <Card className="p-4 sm:p-6 bg-white/70 backdrop-blur-sm border border-white/80 shadow-lg">
            {/* Header */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4 text-purple-500" /> Overall IRP Progress
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">MCQs &amp; Coding Practice combined</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>MCQs</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>Coding</span>
              </div>
            </div>

            {/* Summary row */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Overall ring */}
              <div className="flex items-center gap-4 p-4 bg-purple-100/50 backdrop-blur-sm rounded-2xl border border-purple-200/50">
                <RadialProgress value={overallPct} size={72} strokeWidth={7} colorClass="text-purple-500" trackColorClass="text-purple-100" label="Overall" />
                <div>
                  <p className="font-bold text-purple-600 text-sm">You're doing great!</p>
                  <p className="text-xs text-gray-400 mt-0.5">Keep it up!</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-sm">🏅</div>
                    <p className="text-xs font-black text-gray-700">{milestonePoints.toLocaleString()} <span className="text-gray-400 font-normal">/ {milestoneMax.toLocaleString()} pts</span></p>
                  </div>
                </div>
              </div>
              {/* MCQ summary */}
              <div className="flex items-center gap-4 p-4 bg-blue-100/50 backdrop-blur-sm rounded-2xl border border-blue-200/50">
                <RadialProgress value={displayProgress.overallMcqPercentage} size={72} strokeWidth={7} colorClass="text-blue-500" trackColorClass="text-blue-100" label="MCQs" />
                <div>
                  <p className="text-xs text-gray-500 font-medium">Questions Done</p>
                  <p className="text-xl font-black text-gray-900">{totalMcqAttempted}<span className="text-sm font-medium text-gray-400">/{totalMcqQuestions}</span></p>
                  <p className="text-xs text-red-400 font-semibold mt-1">{totalMcqRemaining} remaining</p>
                  <button className="mt-2 text-[10px] font-bold text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg px-2 py-1 transition-colors flex items-center gap-1">
                    Continue <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {/* Coding summary */}
              <div className="flex items-center gap-4 p-4 bg-green-100/50 backdrop-blur-sm rounded-2xl border border-green-200/50">
                <RadialProgress value={displayProgress.overallCodingPercentage} size={72} strokeWidth={7} colorClass="text-green-500" trackColorClass="text-green-100" label="Coding" />
                <div>
                  <p className="text-xs text-gray-500 font-medium">Problems Solved</p>
                  <p className="text-xl font-black text-gray-900">{totalCodingSolved}<span className="text-sm font-medium text-gray-400">/{totalCodingProblems}</span></p>
                  <p className="text-xs text-red-400 font-semibold mt-1">{totalCodingRemaining} remaining</p>
                  <button className="mt-2 text-[10px] font-bold text-green-600 border border-green-200 hover:bg-green-100 rounded-lg px-2 py-1 transition-colors flex items-center gap-1">
                    Continue <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Subject-wise breakdown — light card grid (kept as designed) */}
            <div className="-mx-1 mt-2 rounded-2xl bg-gray-50 px-4 py-5">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Subject-wise Breakdown
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map((sub) => (
                  <div
                    key={sub.subject}
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <p className="mb-3 text-sm font-bold text-gray-800">{sub.subject}</p>
                    <div className="mb-2.5 flex min-w-0 items-center gap-1.5 sm:gap-2">
                      <span className="w-8 shrink-0 text-[10px] font-bold text-blue-500 sm:w-9 sm:text-[11px]">MCQ</span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-blue-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-700"
                          style={{ width: `${sub.mcqPercentage}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-[10px] font-semibold text-gray-700 sm:w-[3.25rem] sm:text-[11px]">
                        {sub.mcqCompleted}/{sub.mcqTotal}
                      </span>
                      <span className="w-8 shrink-0 text-right text-[10px] font-bold text-blue-500 sm:w-9 sm:text-[11px]">
                        {sub.mcqPercentage}%
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                      <span className="w-8 shrink-0 text-[10px] font-bold text-green-500 sm:w-9 sm:text-[11px]">Code</span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-green-100">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all duration-700"
                          style={{ width: `${sub.codingPercentage}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-[10px] font-semibold text-gray-700 sm:w-[3.25rem] sm:text-[11px]">
                        {sub.codingCompleted}/{sub.codingTotal}
                      </span>
                      <span className="w-8 shrink-0 text-right text-[10px] font-bold text-green-500 sm:w-9 sm:text-[11px]">
                        {sub.codingPercentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Bottom section: Marks | Recent Scores | Weekly Activity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Your Marks Overview */}
            <Card className="p-5 bg-white/70 backdrop-blur-sm border border-white/80 shadow-lg">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-amber-500" /> Your Marks Overview
              </h3>
              <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl mb-3">🔒</div>
                <p className="font-bold text-gray-700 text-sm">Scores Locked</p>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Your marks will be unlocked<br />after the assessment on
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
                  📅 14th June 2026
                </span>
              </div>
            </Card>

            {/* Recent Scores — locked */}
            <Card className="p-5 bg-white/70 backdrop-blur-sm border border-white/80 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Recent Scores</h3>
              </div>
              {/* Blurred preview rows */}
              <div className="relative">
                <div className="text-xs text-gray-400 font-semibold grid grid-cols-[1fr_auto_auto_auto] gap-x-2 pb-2 border-b border-gray-100 mb-2">
                  <span>Subject</span><span>Type</span><span>Score</span><span>%</span>
                </div>
                <div className="space-y-2 select-none blur-sm pointer-events-none" aria-hidden="true">
                  {[
                    { subject: 'HTML & CSS', type: 'MCQ', score: '26/30', pct: '86.7%', mcq: true },
                    { subject: 'HTML & CSS', type: 'Coding', score: '38/50', pct: '76%', mcq: false },
                    { subject: 'JavaScript Essentials', type: 'MCQ', score: '18/25', pct: '72%', mcq: true },
                    { subject: 'JavaScript Essentials', type: 'Coding', score: '32/50', pct: '64%', mcq: false },
                    { subject: 'Python Fundamentals', type: 'MCQ', score: '20/25', pct: '80%', mcq: true },
                  ].map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center py-1.5 border-b border-gray-50">
                      <span className="font-semibold text-gray-800 truncate text-xs">{row.subject}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.mcq ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>{row.type}</span>
                      <span className="text-xs font-bold text-gray-700">{row.score}</span>
                      <span className="text-xs font-bold text-green-600">{row.pct}</span>
                    </div>
                  ))}
                </div>
                {/* Lock overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl mb-2">🔒</div>
                  <p className="font-bold text-gray-700 text-xs text-center">Unlocks after 14th June</p>
                </div>
              </div>
            </Card>

            {/* Weekly Activity bar chart */}
            <Card className="p-4 sm:p-5 bg-white/70 backdrop-blur-sm border border-white/80 shadow-lg">
              <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-bold text-gray-900">Weekly Activity</h3>
                <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>MCQs</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Coding</span>
                </div>
              </div>
              <div className="flex items-end gap-1.5 h-32 mt-4">
                {weeklyActivity.map((day) => {
                  const total = day.mcq + day.coding;
                  const mcqH = weeklyMax > 0 ? (day.mcq / weeklyMax) * 100 : 0;
                  const codingH = weeklyMax > 0 ? (day.coding / weeklyMax) * 100 : 0;
                  return (
                    <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '100px' }}>
                        <div
                          className="w-full rounded-t-sm bg-blue-500 transition-all duration-700"
                          style={{ height: `${mcqH}%` }}
                          title={`${day.mcq} MCQs`}
                        />
                        <div
                          className="w-full bg-green-500 transition-all duration-700"
                          style={{ height: `${codingH}%` }}
                          title={`${day.coding} Coding`}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-gray-400">{day.day}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Bottom target banner */}
          <div className="flex flex-col gap-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/80 px-4 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl shrink-0">🎯</div>
              <p className="text-sm font-semibold text-gray-700">
                Target: Complete remaining <span className="font-black text-gray-900">{totalMcqRemaining} MCQs</span> and{' '}
                <span className="font-black text-gray-900">{totalCodingRemaining} coding problems</span> before 14th June!
              </p>
            </div>
            <button type="button" className="w-full shrink-0 bg-primary hover:bg-primary/90 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 sm:w-auto">
              Let's Do It! 🚀
            </button>
          </div>

          </div>
        </main>
      </div>
    </div>
  );
}
