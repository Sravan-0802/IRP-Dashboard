import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { useGetStudent, getGetStudentQueryKey, useGetStudentProgress, getGetStudentProgressQueryKey, useGetStudentMarks, getGetStudentMarksQueryKey, useGetStudentActivity, getGetStudentActivityQueryKey } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, TrendingUp, Code, BookOpen, Clock, Activity, Trophy, Calendar, LogOut } from 'lucide-react';
import { RadialProgress } from '@/components/ui/radial-progress';

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

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    };

    tick(); // run immediately on mount

    const interval = setInterval(() => {
      const now = Date.now();
      const distance = targetDate - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const isLoading = loadingStudent || loadingProgress || loadingMarks || loadingActivity;

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-72 border-r border-border p-6 flex flex-col gap-6 hidden md:flex shrink-0">
          <Skeleton className="w-32 h-8" />
          <Skeleton className="w-full h-24 rounded-xl" />
          <div className="flex flex-col gap-3 mt-4">
            <Skeleton className="w-full h-10 rounded-lg" />
            <Skeleton className="w-full h-10 rounded-lg" />
            <Skeleton className="w-full h-10 rounded-lg" />
          </div>
        </div>
        <div className="flex-1 p-8 overflow-y-auto">
          <Skeleton className="w-1/3 h-10 mb-2" />
          <Skeleton className="w-1/4 h-5 mb-8" />
          <Skeleton className="w-full h-48 rounded-2xl mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Skeleton className="w-full h-80 rounded-xl" />
            <Skeleton className="w-full h-80 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="w-full h-96 rounded-xl lg:col-span-2" />
            <Skeleton className="w-full h-96 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-card border-r border-border flex flex-col hidden md:flex shrink-0 z-10 animate-in fade-in slide-in-from-left-4 duration-500">
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold font-heading shadow-md">
              N
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">NxtWave IRP</span>
          </div>

          {student && (
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 mb-8 border border-primary/10 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-xl -mr-8 -mt-8 pointer-events-none"></div>
              <div className="flex items-center gap-3 mb-3 relative z-10">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg overflow-hidden border border-primary/20">
                  <img src="/avatar.png" alt={student.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-foreground">{student.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">YOG {student.yog}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-bold px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md shadow-sm relative z-10">
                <span>{student.level}</span>
                <Trophy className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

          <nav className="flex flex-col gap-1.5 mb-8 flex-1">
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-primary/10 text-primary rounded-lg font-semibold text-sm transition-colors relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"></div>
              <Target className="w-4 h-4" /> Dashboard
            </a>
          </nav>

          <div className="mt-auto pt-4 border-t border-border">
            <button className="flex items-center gap-3 w-full px-3 py-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg font-medium text-sm transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-6 md:p-8 md:px-10 space-y-8 pb-20">
          
          {/* Header */}
          <header className="flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500 delay-100 fill-mode-both">
            <div>
              <h1 className="text-3xl font-black font-heading text-foreground tracking-tight">Welcome back, {student?.name.split(' ')[0]}</h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base font-medium">Let's keep the momentum going today.</p>
            </div>
            {progress?.streakDays && progress.streakDays > 0 && (
              <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-4 py-2 rounded-full font-bold text-sm shadow-sm">
                <TrendingUp className="w-4 h-4" /> {progress.streakDays} Day Streak
              </div>
            )}
          </header>

          {/* Hero Countdown */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
            <div className="relative overflow-hidden bg-primary text-primary-foreground rounded-3xl p-8 shadow-xl border border-primary/20">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-black/10 rounded-full blur-3xl"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 text-white text-xs font-bold uppercase tracking-wider mb-5 shadow-sm backdrop-blur-sm border border-white/10">
                    <Clock className="w-3.5 h-3.5" /> Next Milestone
                  </div>
                  <h2 className="text-4xl sm:text-5xl font-black font-heading leading-tight mb-2 tracking-tight">Level 1: The Hustler</h2>
                  <p className="text-primary-foreground/80 font-semibold text-sm sm:text-base">Target: June 14, 2026 Assessment</p>
                </div>
                
                <div className="flex gap-3 sm:gap-4 bg-black/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                  <div className="flex flex-col items-center">
                    <div className="bg-background/10 backdrop-blur-md rounded-xl w-14 h-16 sm:w-20 sm:h-24 flex items-center justify-center text-3xl sm:text-5xl font-black font-mono shadow-inner text-white">
                      {timeLeft.days.toString().padStart(2, '0')}
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold mt-2 uppercase tracking-wider text-primary-foreground/70">Days</span>
                  </div>
                  <div className="flex flex-col justify-center pb-6 text-white/50 text-2xl font-bold">:</div>
                  <div className="flex flex-col items-center">
                    <div className="bg-background/10 backdrop-blur-md rounded-xl w-14 h-16 sm:w-20 sm:h-24 flex items-center justify-center text-3xl sm:text-5xl font-black font-mono shadow-inner text-white">
                      {timeLeft.hours.toString().padStart(2, '0')}
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold mt-2 uppercase tracking-wider text-primary-foreground/70">Hours</span>
                  </div>
                  <div className="flex flex-col justify-center pb-6 text-white/50 text-2xl font-bold">:</div>
                  <div className="flex flex-col items-center">
                    <div className="bg-background/10 backdrop-blur-md rounded-xl w-14 h-16 sm:w-20 sm:h-24 flex items-center justify-center text-3xl sm:text-5xl font-black font-mono shadow-inner text-white">
                      {timeLeft.minutes.toString().padStart(2, '0')}
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold mt-2 uppercase tracking-wider text-primary-foreground/70">Mins</span>
                  </div>
                  <div className="flex flex-col justify-center pb-6 text-white/50 text-2xl font-bold">:</div>
                  <div className="flex flex-col items-center">
                    <div className="bg-background/10 backdrop-blur-md rounded-xl w-14 h-16 sm:w-20 sm:h-24 flex items-center justify-center text-3xl sm:text-5xl font-black font-mono shadow-inner text-white">
                      {timeLeft.seconds.toString().padStart(2, '0')}
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold mt-2 uppercase tracking-wider text-primary-foreground/70">Secs</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Progress Section */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
            <Card className="p-7 border border-border shadow-sm bg-card overflow-hidden hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="font-bold text-xl font-heading flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-500" /> MCQ Progress
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">Concept mastery across subjects</p>
                </div>
                <div className="flex items-center justify-center p-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                  <RadialProgress 
                    value={progress?.overallMcqPercentage || 0} 
                    size={64} 
                    strokeWidth={6}
                    colorClass="text-blue-500"
                    trackColorClass="text-blue-100 dark:text-blue-950"
                  />
                </div>
              </div>
              
              <div className="space-y-6">
                {progress?.subjects.map(sub => (
                  <div key={sub.subject} className="group/item">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="font-semibold text-foreground group-hover/item:text-blue-500 transition-colors">{sub.subject}</span>
                      <span className="text-muted-foreground font-medium font-mono text-xs">{sub.mcqCompleted}/{sub.mcqTotal}</span>
                    </div>
                    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-1000 ease-out" 
                        style={{ width: `${sub.mcqPercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-7 border border-border shadow-sm bg-card overflow-hidden hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="font-bold text-xl font-heading flex items-center gap-2">
                    <Code className="w-5 h-5 text-emerald-500" /> Coding Practice
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">Hands-on problem solving</p>
                </div>
                <div className="flex items-center justify-center p-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                  <RadialProgress 
                    value={progress?.overallCodingPercentage || 0} 
                    size={64} 
                    strokeWidth={6}
                    colorClass="text-emerald-500"
                    trackColorClass="text-emerald-100 dark:text-emerald-950"
                  />
                </div>
              </div>
              
              <div className="space-y-6">
                {progress?.subjects.map(sub => (
                  <div key={sub.subject} className="group/item">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="font-semibold text-foreground group-hover/item:text-emerald-500 transition-colors">{sub.subject}</span>
                      <span className="text-muted-foreground font-medium font-mono text-xs">{sub.codingCompleted}/{sub.codingTotal}</span>
                    </div>
                    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-1000 ease-out" 
                        style={{ width: `${sub.codingPercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {/* Marks and Activity Section */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400 fill-mode-both">
            <div className="lg:col-span-2">
              <Card className="border border-border shadow-sm bg-card overflow-hidden h-full">
                <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
                  <h3 className="font-bold text-lg font-heading">Recent Scores</h3>
                  <button className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">View All</button>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-bold border-b border-border/50">Subject & Category</th>
                        <th className="px-6 py-4 font-bold border-b border-border/50">Type</th>
                        <th className="px-6 py-4 font-bold border-b border-border/50">Score</th>
                        <th className="px-6 py-4 font-bold text-right border-b border-border/50">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marks?.slice(0, 5).map((mark, i) => (
                        <tr key={mark.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground group-hover:text-primary transition-colors">{mark.subject}</div>
                            <div className="text-xs text-muted-foreground font-medium mt-0.5">{mark.category}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground border border-border/50">
                              {mark.assessmentType}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium font-mono text-muted-foreground">
                            <span className="text-foreground font-bold text-base">{mark.score}</span> <span className="text-xs">/ {mark.maxScore}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold border ${
                              mark.percentage >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                              mark.percentage >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                              'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                            }`}>
                              {mark.percentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6 border border-border shadow-sm bg-card h-full">
                <h3 className="font-bold text-lg font-heading flex items-center gap-2 mb-6">
                  <Activity className="w-5 h-5 text-primary" /> Activity Pulse
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-secondary/50 p-4 rounded-2xl border border-border/50">
                    <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Total MCQs</div>
                    <div className="text-3xl font-black font-mono text-foreground">{activity?.totalMcqSolved}</div>
                  </div>
                  <div className="bg-secondary/50 p-4 rounded-2xl border border-border/50">
                    <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Total Codes</div>
                    <div className="text-3xl font-black font-mono text-foreground">{activity?.totalCodingSolved}</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center justify-between">
                    <span>Weekly Practice</span>
                    <span className="text-[10px] font-medium bg-secondary px-2 py-0.5 rounded text-foreground">Last 7 Days</span>
                  </h4>
                  <div className="space-y-3.5">
                    {activity?.weeklyActivity.map(day => (
                      <div key={day.day} className="flex items-center gap-3 group">
                        <div className="w-8 text-xs font-bold text-muted-foreground text-right group-hover:text-foreground transition-colors">{day.day}</div>
                        <div className="flex-1 h-2 flex bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-1000 ease-out" 
                            style={{ width: `${Math.min(100, (day.mcq / 20) * 100)}%` }}
                            title={`${day.mcq} MCQs`}
                          />
                          <div 
                            className="h-full bg-emerald-500 border-l border-background/50 transition-all duration-1000 ease-out" 
                            style={{ width: `${Math.min(100, (day.coding / 5) * 100)}%` }}
                            title={`${day.coding} Coding`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-5 pt-5 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      MCQs
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      Coding
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
