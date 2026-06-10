import { TRACKS } from "@/lib/courses";
import type { SubjectRow } from "@/components/irp/ProgressSummary";

/** Known display name → alternate titles from BigQuery / academy sync. */
const COURSE_ALIASES: Record<string, string[]> = {
  "getting started with react js": ["introduction to react js"],
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchSubject(course: string, subjects: SubjectRow[]): SubjectRow | null {
  const cNorm = normalizeTitle(course);
  const aliases = COURSE_ALIASES[cNorm] ?? [];

  const candidates = [cNorm, ...aliases.map(normalizeTitle)];

  for (const candidate of candidates) {
    const exact = subjects.find((s) => normalizeTitle(s.subject) === candidate);
    if (exact) return exact;
  }

  for (const candidate of candidates) {
    const hit = subjects.find(
      (s) =>
        candidate.includes(normalizeTitle(s.subject)) ||
        normalizeTitle(s.subject).includes(candidate),
    );
    if (hit) return hit;
  }

  const cWords = new Set(cNorm.split(" ").filter((w) => w.length > 3));
  return (
    subjects.find((s) =>
      normalizeTitle(s.subject)
        .split(" ")
        .some((w) => cWords.has(w)),
    ) ?? null
  );
}

export function subjectsForTrack(courses: string[], subjects: SubjectRow[]): SubjectRow[] {
  const matched = subjects.filter((s) =>
    courses.some((course) => matchSubject(course, [s]) !== null),
  );
  return matched.length > 0 ? matched : subjects;
}

export function buildSubjectStatsRows(subjects: SubjectRow[], level: 1 | 2 | 3) {
  return TRACKS.filter((t) => t.level === level).flatMap((track) =>
    track.courses.map((course) => ({
      course,
      trackName: track.name,
      data: matchSubject(course, subjects),
    })),
  );
}
