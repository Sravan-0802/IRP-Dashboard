import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import {
  useGetStudent, getGetStudentQueryKey,
  useGetStudentProgress, getGetStudentProgressQueryKey,
  useGetStudentMarks, getGetStudentMarksQueryKey,
  useGetStudentActivity, getGetStudentActivityQueryKey,
} from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard, BookOpen, Code, ClipboardList, TrendingUp,
  Award, Calendar, FolderOpen, Settings, LogOut, Flame, ChevronDown,
  ArrowRight, Trophy, Target, Clock,
} from 'lucide-react';
import { RadialProgress } from '@/components/ui/radial-progress';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
];

function CircularCountdown({ days }: { days: number }) {
  const totalDays = 61;
  const radius = 46;
  const size = 120;
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2e2e4a" strokeWidth="9" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - arcLength}
          style={{ filter: 'drop-shadow(0 0 6px #f59e0baa)' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Starts In</span>
        <span className="text-4xl font-black leading-none text-amber-400" style={{ textShadow: '0 0 16px #f59e0b88' }}>
          {days}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Days</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: student, isLoading: loadingStudent } = useGetStudent({ query: { queryKey: getGetStudentQueryKey() } });
  const { data: progress, isLoading: loadingProgress } = useGetStudentProgress({ query: { queryKey: getGetStudentProgressQueryKey() } });
  const { data: marks, isLoading: loadingMarks } = useGetStudentMarks({ query: { queryKey: getGetStudentMarksQueryKey() } });
  const { data: activity, isLoading: loadingActivity } = useGetStudentActivity({ query: { queryKey: getGetStudentActivityQueryKey() } });

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

  const isLoading = loadingStudent || loadingProgress || loadingMarks || loadingActivity;

  // Compute MCQ totals
  const totalMcqQuestions = progress?.subjects.reduce((a, s) => a + s.mcqTotal, 0) ?? 0;
  const totalMcqAttempted = progress?.subjects.reduce((a, s) => a + s.mcqCompleted, 0) ?? 0;
  const totalMcqRemaining = totalMcqQuestions - totalMcqAttempted;

  // Compute Coding totals
  const totalCodingProblems = progress?.subjects.reduce((a, s) => a + s.codingTotal, 0) ?? 0;
  const totalCodingSolved = progress?.subjects.reduce((a, s) => a + s.codingCompleted, 0) ?? 0;
  const totalCodingRemaining = totalCodingProblems - totalCodingSolved;

  // Compute marks summary
  const mcqMarks = marks?.filter(m => m.category === 'MCQ') ?? [];
  const codingMarks = marks?.filter(m => m.category === 'Coding') ?? [];
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
  const overallPct = Math.round(((progress?.overallMcqPercentage ?? 0) + (progress?.overallCodingPercentage ?? 0)) / 2);

  // Milestone points
  const milestonePoints = (activity?.totalMcqSolved ?? 0) * 5 + (activity?.totalCodingSolved ?? 0) * 10;
  const milestoneMax = 2000;

  // Weekly bar chart max
  const weeklyMax = Math.max(...(activity?.weeklyActivity.map(d => d.mcq + d.coding) ?? [1]));

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-60 border-r border-border p-5 flex flex-col gap-4 hidden md:flex shrink-0">
          <Skeleton className="w-32 h-7" />
          <Skeleton className="w-full h-20 rounded-xl" />
          <div className="flex flex-col gap-2 mt-2">
            {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="w-full h-9 rounded-lg" />)}
          </div>
        </div>
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          <Skeleton className="w-72 h-9" />
          <Skeleton className="w-full h-36 rounded-2xl" />
          <div className="grid grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#ede9fe] via-[#f5f3ff] to-[#dde8ff] text-foreground overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-60 bg-white/75 backdrop-blur-xl border-r border-white/60 flex flex-col shrink-0 hidden md:flex shadow-xl">
        {/* Logo */}
        <div className="px-5 pt-4 pb-4 flex items-center border-b border-white/50">
          <img src="/nxtwave-logo.png" alt="NxtWave Academy" className="h-9 w-auto object-contain" />
        </div>

        {/* Student profile */}
        {student && (
          <div className="px-4 py-4 border-b border-white/50">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 border border-white/60 cursor-pointer hover:bg-white/70 transition-colors">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 shrink-0">
                <img src="/avatar.png" alt={student.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{student.name}</p>
                <p className="text-xs text-gray-500 font-medium">YOG {student.yog}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-bold px-3 py-1.5 bg-primary text-white rounded-lg">
              <span>Level 1 • The Hustler</span>
              <Trophy className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
            <a
              key={label}
              href="#"
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

        {/* Logout */}
        <div className="px-3 py-3 border-t border-white/50">
          <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50/60 transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5 max-w-[1100px] mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-gray-900">
                Welcome back, {student?.name.split(' ')[0]}! 👋
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Let's continue your learning journey and crush the assessment.</p>
            </div>
            {(progress?.streakDays ?? 0) > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 px-4 py-2 rounded-full font-bold text-sm">
                <Flame className="w-4 h-4" /> {progress?.streakDays} Day Streak
              </div>
            )}
          </div>

          {/* Assessment Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#5b21b6] via-[#6d28d9] to-[#7c3aed] text-white shadow-lg">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="relative flex items-center justify-between px-8 py-6 gap-6">
              {/* Left */}
              <div className="flex items-center gap-6 flex-1">
                <div className="text-6xl select-none">🚀</div>
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider mb-3 border border-white/20">
                    <Clock className="w-3 h-3" /> Upcoming Assessment
                  </div>
                  <h2 className="text-2xl font-black leading-tight">Level 1: The Hustler</h2>
                  <p className="text-white/75 text-sm font-medium mt-1">14 June 2026 • IRP Assessment</p>
                </div>
              </div>

              {/* Right: circular countdown */}
              <div className="shrink-0 flex flex-col items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/60 text-center">Assessment Countdown</p>
                <CircularCountdown days={timeLeft.days} />
              </div>
            </div>
          </div>

          {/* Journey Stepper */}
          <div className="bg-white/70 backdrop-blur-sm border border-white/80 shadow-lg rounded-2xl px-8 py-6">
            <div className="flex items-start justify-between relative">
              {/* Dotted connector line */}
              <div className="absolute top-7 left-[16.7%] right-[16.7%] h-px border-t-2 border-dashed border-gray-200 z-0" />

              {/* Step 1 — In Progress */}
              <div className="flex flex-col items-center text-center w-1/3 relative z-10">
                <div className="w-14 h-14 rounded-full bg-white border-2 border-orange-400 flex items-center justify-center mb-3 shadow-sm">
                  <span className="text-xl">📋</span>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-400 text-white text-[10px] font-black flex items-center justify-center">1</span>
                </div>
                <p className="font-bold text-gray-900 text-sm">An Online Assessment</p>
                <span className="mt-1.5 inline-block px-3 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600">In Progress</span>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">Attempt the online assessment and qualify for Level 2 access.</p>
              </div>

              {/* Step 2 — Not Started */}
              <div className="flex flex-col items-center text-center w-1/3 relative z-10">
                <div className="w-14 h-14 rounded-full bg-white border-2 border-indigo-400 flex items-center justify-center mb-3 shadow-sm">
                  <span className="text-xl">👥</span>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-400 text-white text-[10px] font-black flex items-center justify-center">2</span>
                </div>
                <p className="font-bold text-gray-900 text-sm">Post-Assessment (Level 1)</p>
                <span className="mt-1.5 inline-block px-3 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-500">Not Started</span>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">Complete projects and mock interviews to unlock Level 2 access.</p>
              </div>

              {/* Step 3 — Locked */}
              <div className="flex flex-col items-center text-center w-1/3 relative z-10">
                <div className="w-14 h-14 rounded-full bg-gray-50 border-2 border-gray-300 flex items-center justify-center mb-3 shadow-sm">
                  <span className="text-xl">🔒</span>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-400 text-white text-[10px] font-black flex items-center justify-center">3</span>
                </div>
                <p className="font-bold text-gray-400 text-sm">Level 2 Access</p>
                <span className="mt-1.5 inline-block px-3 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-500">Locked</span>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">Unlock advanced tracks, internships and exclusive benefits.</p>
              </div>
            </div>
          </div>

          {/* Combined Overall IRP Progress */}
          <Card className="p-6 bg-white/70 backdrop-blur-sm border border-white/80 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4 text-purple-500" /> Overall IRP Progress
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">MCQs &amp; Coding Practice combined</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>MCQs</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>Coding</span>
              </div>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
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
                <RadialProgress value={progress?.overallMcqPercentage ?? 0} size={72} strokeWidth={7} colorClass="text-blue-500" trackColorClass="text-blue-100" label="MCQs" />
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
                <RadialProgress value={progress?.overallCodingPercentage ?? 0} size={72} strokeWidth={7} colorClass="text-green-500" trackColorClass="text-green-100" label="Coding" />
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

            {/* Subject-wise breakdown */}
            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Subject-wise Breakdown</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {progress?.subjects.map(sub => (
                  <div key={sub.subject} className="bg-white/50 rounded-xl p-3 border border-white/60">
                    <p className="text-xs font-bold text-gray-700 mb-2">{sub.subject}</p>
                    {/* MCQ row */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold text-blue-500 w-10 shrink-0">MCQ</span>
                      <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${sub.mcqPercentage}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-gray-700 w-12 text-right shrink-0">{sub.mcqCompleted}/{sub.mcqTotal}</span>
                      <span className="text-[10px] font-bold text-blue-500 w-8 text-right shrink-0">{sub.mcqPercentage}%</span>
                    </div>
                    {/* Coding row */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-green-500 w-10 shrink-0">Code</span>
                      <div className="flex-1 h-1.5 bg-green-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${sub.codingPercentage}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-gray-700 w-12 text-right shrink-0">{sub.codingCompleted}/{sub.codingTotal}</span>
                      <span className="text-[10px] font-bold text-green-500 w-8 text-right shrink-0">{sub.codingPercentage}%</span>
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
            <Card className="p-5 bg-white/70 backdrop-blur-sm border border-white/80 shadow-lg">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-900">Weekly Activity</h3>
                <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>MCQs</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Coding</span>
                </div>
              </div>
              <div className="flex items-end gap-1.5 h-32 mt-4">
                {activity?.weeklyActivity.map((day) => {
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
          <div className="flex items-center justify-between bg-white/70 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/80 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl shrink-0">🎯</div>
              <p className="text-sm font-semibold text-gray-700">
                Target: Complete remaining <span className="font-black text-gray-900">{totalMcqRemaining} MCQs</span> and{' '}
                <span className="font-black text-gray-900">{totalCodingRemaining} coding problems</span> before 14th June!
              </p>
            </div>
            <button className="shrink-0 ml-4 bg-primary hover:bg-primary/90 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2">
              Let's Do It! 🚀
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
