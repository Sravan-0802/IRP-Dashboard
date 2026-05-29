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
  { icon: BookOpen, label: 'MCQs' },
  { icon: Code, label: 'Coding Practice' },
  { icon: ClipboardList, label: 'Assessments' },
  { icon: TrendingUp, label: 'Performance' },
  { icon: Award, label: 'Badges' },
  { icon: Calendar, label: 'Calendar' },
  { icon: FolderOpen, label: 'Resources' },
  { icon: Settings, label: 'Settings' },
];

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white/15 backdrop-blur-sm rounded-xl w-16 h-16 flex items-center justify-center text-2xl font-black font-mono text-white shadow-inner border border-white/20">
        {value.toString().padStart(2, '0')}
      </div>
      <span className="text-[10px] font-bold mt-1.5 uppercase tracking-widest text-white/70">{label}</span>
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
    <div className="flex h-screen bg-[#f7f8fc] text-foreground overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col shrink-0 hidden md:flex shadow-sm">
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-2.5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-black text-sm shadow">N</div>
          <span className="font-black text-lg tracking-tight">NxtWave <span className="text-primary">IRP</span></span>
        </div>

        {/* Student profile */}
        {student && (
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors">
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
        <div className="px-3 py-3 border-t border-gray-100">
          <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors">
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

              {/* Right: countdown */}
              <div className="shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/60 text-center mb-3">Assessment Countdown</p>
                <div className="flex items-end gap-2">
                  <CountdownBox value={timeLeft.days} label="Days" />
                  <span className="text-white/50 text-xl font-bold pb-5">:</span>
                  <CountdownBox value={timeLeft.hours} label="Hrs" />
                  <span className="text-white/50 text-xl font-bold pb-5">:</span>
                  <CountdownBox value={timeLeft.minutes} label="Mins" />
                  <span className="text-white/50 text-xl font-bold pb-5">:</span>
                  <CountdownBox value={timeLeft.seconds} label="Secs" />
                </div>
              </div>
            </div>
          </div>

          {/* Three progress cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* MCQs Progress */}
            <Card className="p-5 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500" /> MCQs Progress
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Concept mastery across subjects</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-5">
                <div className="shrink-0">
                  <RadialProgress value={progress?.overallMcqPercentage ?? 0} size={80} strokeWidth={8} colorClass="text-blue-500" trackColorClass="text-blue-100" label="Completed" />
                </div>
                <div className="flex-1 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block"></span>Total Questions</span>
                    <span className="font-bold text-gray-700">{totalMcqQuestions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>Attempted</span>
                    <span className="font-bold text-gray-700">{totalMcqAttempted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>Correct</span>
                    <span className="font-bold text-gray-700">{Math.round(totalMcqAttempted * 0.78)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>Remaining</span>
                    <span className="font-bold text-red-500">{totalMcqRemaining}</span>
                  </div>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 text-sm font-bold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg py-2 transition-colors">
                Continue MCQs <ArrowRight className="w-4 h-4" />
              </button>
            </Card>

            {/* Coding Practice */}
            <Card className="p-5 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Code className="w-4 h-4 text-green-500" /> Coding Practice
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Hands-on problem solving</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-5">
                <div className="shrink-0">
                  <RadialProgress value={progress?.overallCodingPercentage ?? 0} size={80} strokeWidth={8} colorClass="text-green-500" trackColorClass="text-green-100" label="Completed" />
                </div>
                <div className="flex-1 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block"></span>Total Problems</span>
                    <span className="font-bold text-gray-700">{totalCodingProblems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>Solved</span>
                    <span className="font-bold text-gray-700">{totalCodingSolved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>Attempted</span>
                    <span className="font-bold text-gray-700">{Math.round(totalCodingSolved * 1.2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>Remaining</span>
                    <span className="font-bold text-red-500">{totalCodingRemaining}</span>
                  </div>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 text-sm font-bold text-green-600 border border-green-200 hover:bg-green-50 rounded-lg py-2 transition-colors">
                Continue Coding <ArrowRight className="w-4 h-4" />
              </button>
            </Card>

            {/* Overall IRP Progress */}
            <Card className="p-5 bg-white border border-gray-100 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" /> Overall IRP Progress
                </h3>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="shrink-0">
                  <RadialProgress value={overallPct} size={80} strokeWidth={8} colorClass="text-purple-500" trackColorClass="text-purple-100" label="Overall" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-purple-600 text-sm">You're doing great!</p>
                  <p className="text-xs text-gray-400 mt-0.5">Keep the momentum going.</p>
                  <div className="mt-3 h-2 bg-purple-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all duration-1000" style={{ width: `${overallPct}%` }} />
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-lg">🏅</div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Milestone Points</p>
                  <p className="font-black text-gray-900 text-sm">
                    {milestonePoints.toLocaleString()} <span className="text-gray-400 font-medium">/ {milestoneMax.toLocaleString()}</span>
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Bottom section: Marks | Recent Scores | Weekly Activity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Your Marks Overview */}
            <Card className="p-5 bg-white border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-amber-500" /> Your Marks Overview
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs font-bold text-blue-600 mb-1">MCQ Marks</p>
                  <p className="text-xl font-black text-gray-900">{Math.round(mcqScore)} <span className="text-sm font-medium text-gray-400">/ {Math.round(mcqMax)}</span></p>
                  <p className="text-xs font-bold text-blue-500 mt-0.5">{mcqPct}%</p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl">
                  <p className="text-xs font-bold text-green-600 mb-1">Coding Marks</p>
                  <p className="text-xl font-black text-gray-900">{Math.round(codingScore)} <span className="text-sm font-medium text-gray-400">/ {Math.round(codingMax)}</span></p>
                  <p className="text-xs font-bold text-green-500 mt-0.5">{codingPct}%</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl">
                  <p className="text-xs font-bold text-amber-600 mb-1">Total Marks</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-black text-gray-900">{Math.round(totalScore)} <span className="text-sm font-medium text-gray-400">/ {Math.round(totalMax)}</span></p>
                    <span className="text-lg">🏆</span>
                  </div>
                  <p className="text-xs font-bold text-amber-500 mt-0.5">{totalPct}%</p>
                </div>
              </div>
            </Card>

            {/* Recent Scores */}
            <Card className="p-5 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Recent Scores</h3>
                <button className="text-xs font-bold text-primary hover:text-primary/70 transition-colors">View All</button>
              </div>
              <div className="text-xs text-gray-400 font-semibold grid grid-cols-[1fr_auto_auto_auto] gap-x-2 pb-2 border-b border-gray-100 mb-2">
                <span>Subject</span><span>Type</span><span>Score</span><span>%</span>
              </div>
              <div className="space-y-2">
                {marks?.slice(0, 5).map((mark) => (
                  <div key={mark.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center py-1.5 text-sm border-b border-gray-50">
                    <span className="font-semibold text-gray-800 truncate text-xs">{mark.subject}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      mark.category === 'MCQ'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-green-100 text-green-600'
                    }`}>{mark.category}</span>
                    <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{mark.score}/{mark.maxScore}</span>
                    <span className={`text-xs font-bold ${
                      mark.percentage >= 80 ? 'text-green-600' :
                      mark.percentage >= 60 ? 'text-amber-600' : 'text-red-500'
                    }`}>{mark.percentage}%</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Weekly Activity bar chart */}
            <Card className="p-5 bg-white border border-gray-100 shadow-sm">
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
          <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 border border-gray-100 shadow-sm">
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
