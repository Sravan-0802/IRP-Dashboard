import { ArrowRight, Code2, Database, GitBranch, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { getLevel, type Journey } from "@/lib/journey";
import { coursesForLevel, type CourseLink, type CourseTrack } from "@/lib/levelCourses";

type LevelStyle = {
  /** Circle, eyebrow and accent colours for this level. */
  accent: string;
  ring: string;
  rail: string;
  countBg: string;
};

const LEVEL_STYLE: Record<1 | 2 | 3, LevelStyle> = {
  1: { accent: "#444ce7", ring: "#e0eaff", rail: "#c7d7fe", countBg: "#eef4ff" },
  2: { accent: "#f79009", ring: "#fef0c7", rail: "#fedf89", countBg: "#fffaeb" },
  3: { accent: "#e31b54", ring: "#ffe4e8", rail: "#fecdd6", countBg: "#fff1f3" },
};

const LEVEL_COPY: Record<1 | 2 | 3, { eyebrow: string; heading: string; unlock: string | null }> = {
  1: { eyebrow: "Level 1 · The Builder", heading: "Frontend & Programming", unlock: "Clear L1 to unlock L2" },
  2: { eyebrow: "Level 2 · The AI Architect", heading: "Backend, Databases & Generative AI", unlock: "Clear L2 to unlock L3" },
  3: { eyebrow: "Level 3 · Infinite Aura", heading: "Infinite Aura: Top 1% Track", unlock: null },
};

const TRACK_ICON: Record<string, LucideIcon> = {
  "Frontend Track": Code2,
  "Coding Track": GitBranch,
  "Backend Track": Database,
  "Generative AI Track": Sparkles,
};

/** Display names on this page; destinations always come from levelCourses.ts. */
const DISPLAY_NAME: Record<string, string> = {
  "DSA — Level 2": "DSA - Level 2",
  "DSA — Level 3": "DSA - Level 3",
  "DSA — Level 4": "DSA - Level 4",
  "CodeChef (aim for rating > 1600 for L3)": "CodeChef (aim for a rating above 1600 for L3)",
};

function courseCount(n: number): string {
  return `${n} ${n === 1 ? "course" : "courses"}`;
}

function CourseRow({ course }: { course: CourseLink }) {
  return (
    <a
      href={course.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-3 border-t border-[#eaecf0] px-4 py-3 text-[13px] text-[#344054] transition-colors hover:bg-[#f9fafb] hover:text-[#101828]"
    >
      <span className="min-w-0">{DISPLAY_NAME[course.name] ?? course.name}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#98a2b3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#475467]" />
    </a>
  );
}

function CardHeader({
  title,
  Icon,
  count,
  style,
}: {
  title: string;
  Icon: LucideIcon;
  count: number;
  style: LevelStyle;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#101828]">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: style.accent }} />
        {title}
      </p>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={{ backgroundColor: style.countBg, color: style.accent }}
      >
        {courseCount(count)}
      </span>
    </div>
  );
}

function TrackCard({ track, style }: { track: CourseTrack; style: LevelStyle }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#eaecf0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <CardHeader title={track.title} Icon={TRACK_ICON[track.title] ?? Code2} count={track.items.length} style={style} />
      {track.items.map((course) => <CourseRow key={course.url} course={course} />)}
    </div>
  );
}

/** Level 3 shows DSA and practice platforms together, side by side. */
function Level3Card({ tracks, style }: { tracks: CourseTrack[]; style: LevelStyle }) {
  const total = tracks.reduce((sum, t) => sum + t.items.length, 0);
  return (
    <div className="overflow-hidden rounded-xl border border-[#eaecf0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <CardHeader title="Level 3 Prep: DSA & Practice Platforms" Icon={Trophy} count={total} style={style} />
      <div className="grid sm:grid-cols-2">
        {tracks.map((track, i) => (
          <div key={track.title} className={i > 0 ? "sm:border-l sm:border-[#eaecf0]" : undefined}>
            {track.items.map((course) => <CourseRow key={course.url} course={course} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WhatToStudy({ journey }: { journey: Journey }) {
  const current = getLevel(journey.journeyState);
  const levels = ([1, 2, 3] as const).map((level) => ({ level, data: coursesForLevel(level) }));

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-[#6941c6]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6941c6]" aria-hidden />
          RESOURCE HUB
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#101828] sm:text-[28px]">
          What to Study
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#667085]">
          Courses to lock in for each level. Tap a course to open it on the Learning Portal.
        </p>
      </div>

      <section className="rounded-2xl border border-[#eaecf0] bg-white p-4 sm:p-6" data-testid="what-to-study">
        <ol className="space-y-8">
          {levels.map(({ level, data }, index) => {
            if (!data) return null;
            const style = LEVEL_STYLE[level];
            const copy = LEVEL_COPY[level];
            const isLast = index === levels.length - 1;
            return (
              <li key={level} className="relative flex gap-3 sm:gap-5" data-testid={`study-level-${level}`}>
                {!isLast ? (
                  <span
                    aria-hidden
                    className="absolute bottom-[-2rem] left-[21px] top-12 w-0.5 sm:left-[23px]"
                    style={{ backgroundColor: style.rail }}
                  />
                ) : null}
                <span
                  className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold text-white sm:h-12 sm:w-12"
                  style={{ backgroundColor: style.accent, boxShadow: `0 0 0 5px ${style.ring}` }}
                >
                  {data.label}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: style.accent }}>
                      {copy.eyebrow}
                    </p>
                    {level === current ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white"
                        style={{ backgroundColor: style.accent }}
                        data-testid="badge-you-are-here"
                      >
                        You are here
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-1 font-display text-lg font-extrabold tracking-tight text-[#101828] sm:text-xl">
                    {copy.heading}
                  </h2>

                  <div className="mt-4">
                    {level === 3 ? (
                      <Level3Card tracks={data.tracks} style={style} />
                    ) : (
                      <div className="grid items-start gap-3 lg:grid-cols-2">
                        {data.tracks.map((track) => <TrackCard key={track.title} track={track} style={style} />)}
                      </div>
                    )}
                  </div>

                  {copy.unlock ? (
                    <p
                      className="mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em]"
                      style={{ color: style.accent }}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      {copy.unlock}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
