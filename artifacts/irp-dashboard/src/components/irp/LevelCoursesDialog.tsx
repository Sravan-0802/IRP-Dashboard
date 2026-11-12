import { BookOpen, Clock, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GENAI_COURSE_TRACKS,
  L1_ASSESSMENT_PATTERN,
  coursesForLevel,
  type CourseTrack,
} from "@/lib/levelCourses";

type Palette = { solid: string; soft: string; ring: string; text: string; hover: string };

const BLUE: Palette = { solid: "#2563eb", soft: "#eff6ff", ring: "#dbeafe", text: "#1d4ed8", hover: "#f5f8ff" };
const INDIGO: Palette = { solid: "#6941c6", soft: "#f4f3ff", ring: "#e9d7fe", text: "#5925dc", hover: "#faf8ff" };

function CoursesDialog({
  open,
  onOpenChange,
  badge,
  eyebrow,
  title,
  description,
  pattern,
  tracks,
  palette,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge: string;
  eyebrow: string;
  title: string;
  description: string;
  pattern?: readonly string[];
  tracks: CourseTrack[];
  palette: Palette;
  testId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-[min(720px,calc(100vw-2rem))] overflow-y-auto"
        data-testid={testId}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold text-white"
              style={{ backgroundColor: palette.solid, boxShadow: `0 0 0 4px ${palette.ring}` }}
            >
              {badge}
            </span>
            <div className="text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: palette.solid }}>
                {eyebrow}
              </p>
              <DialogTitle className="font-display text-xl font-extrabold text-[#101828]">{title}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="pt-1 text-left">{description}</DialogDescription>
        </DialogHeader>

        {pattern ? (
          <div className="rounded-xl border px-4 py-3" style={{ borderColor: palette.ring, backgroundColor: palette.soft }}>
            <p
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: palette.text }}
            >
              <Clock className="h-3.5 w-3.5" />
              Assessment pattern
            </p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-[#344054]">
              {pattern.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={`grid gap-3 ${tracks.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {tracks.map((track) => (
            <section key={track.title} className="rounded-xl border border-[#eaecf0] bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-[#f2f4f7] px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#101828]">
                  <BookOpen className="h-4 w-4" style={{ color: palette.solid }} />
                  {track.title}
                </h3>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: palette.soft, color: palette.text }}
                >
                  {track.items.length}
                </span>
              </div>
              <ul className="divide-y divide-[#f2f4f7]">
                {track.items.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-[#344054] transition-colors hover:bg-[var(--row-hover)] focus:outline-none focus-visible:bg-[var(--row-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--row-ring)]"
                      style={{ ["--row-hover" as string]: palette.hover, ["--row-ring" as string]: palette.solid }}
                    >
                      <span className="min-w-0">{item.name}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#98a2b3]" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function L1CoursesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const level = coursesForLevel(1);
  if (!level) return null;
  return (
    <CoursesDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={level.label}
      eyebrow="Level 1 courses"
      title={level.heading}
      description="Revise these courses on the learning portal to prepare for the L1 online assessment."
      pattern={L1_ASSESSMENT_PATTERN}
      tracks={level.tracks}
      palette={BLUE}
      testId="dialog-l1-courses"
    />
  );
}

export function GenAiCoursesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <CoursesDialog
      open={open}
      onOpenChange={onOpenChange}
      badge="AI"
      eyebrow="GenAI Track courses"
      title="How to clear"
      description="Go through these RAG courses on the learning portal to prepare for your GenAI assessments and projects."
      tracks={GENAI_COURSE_TRACKS}
      palette={INDIGO}
      testId="dialog-genai-courses"
    />
  );
}
