import { GetGenaiHumanInterviewResultsResponse } from "@workspace/api-zod";
import { interviewTimestamp } from "./humanInterviewData";

export const GENAI_NEXUS_TEMPLATE = "irp-gen-ai";

const attemptSchema = GetGenaiHumanInterviewResultsResponse.shape.attempts.element;
export type GenaiInterviewAttempt = ReturnType<typeof attemptSchema.parse>;
export type GenaiNexusInterview = GenaiInterviewAttempt & { candidateId: string };

const RATING_KEYS = ["projectRating", "conceptRating", "dsaRating", "communicationRating"] as const;
const REMARK_KEYS = ["projectRemarks", "conceptRemarks", "dsaRemarks", "communicationRemarks"] as const;

/** The upstream status is authoritative; unknown statuses are never completed. */
export function isScoredGenaiInterview(attempt: GenaiInterviewAttempt): boolean {
  return attempt.finalScore !== null &&
    (attempt.clearanceStatus === "Cleared" || attempt.clearanceStatus === "Not Cleared");
}

export function summarizeGenaiInterviews<T extends GenaiInterviewAttempt>(rows: T[]) {
  const attempts = [...rows].sort((a, b) =>
    interviewTimestamp(b) - interviewTimestamp(a) || a.interviewId.localeCompare(b.interviewId));
  return { attempts, latestResult: attempts.find(isScoredGenaiInterview) ?? null };
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Academy Nexus returned invalid GenAI interview remarks");
  return value.trim() ? value.trim() : null;
}

export function parseGenaiNexusPage(value: unknown): { results: GenaiNexusInterview[]; nextCursor: string | null } {
  if (!value || typeof value !== "object") throw new Error("Academy Nexus returned an invalid page");
  const page = value as Record<string, unknown>;
  if (page.template !== GENAI_NEXUS_TEMPLATE || !Array.isArray(page.results) ||
      page.count !== page.results.length ||
      (page.nextCursor !== null && (typeof page.nextCursor !== "string" || !page.nextCursor))) {
    throw new Error("Academy Nexus returned an invalid IRP GenAI page");
  }
  const results = page.results.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("Academy Nexus returned an invalid GenAI interview");
    const source = raw as Record<string, unknown>;
    if (typeof source.candidateId !== "string" || !source.candidateId.trim()) {
      throw new Error("Academy Nexus returned a GenAI interview without an Academy UID");
    }
    const normalized = {
      interviewId: source.interviewId,
      interviewDate: source.interviewDate,
      interviewStartTime: source.interviewStartTime,
      projectRating: source.projectRating ?? null,
      conceptRating: source.conceptRating ?? null,
      dsaRating: source.dsaRating ?? null,
      communicationRating: source.communicationRating ?? null,
      finalScore: source.finalScore ?? null,
      verdictBand: typeof source.verdictBand === "string" ? source.verdictBand.trim() : "",
      clearanceStatus: source.clearanceStatus,
      ...Object.fromEntries(REMARK_KEYS.map((key) => [key, optionalText(source[key])])),
    };
    const parsed = attemptSchema.safeParse(normalized);
    if (!parsed.success || !parsed.data.interviewId.trim()) {
      throw new Error("Academy Nexus returned invalid GenAI interview result fields");
    }
    for (const key of RATING_KEYS) {
      const score = parsed.data[key];
      if (score !== null && (!Number.isFinite(score) || score < 0 || score > 5)) {
        throw new Error("Academy Nexus returned an invalid GenAI interview rating");
      }
    }
    const final = parsed.data.finalScore;
    if (final !== null && (!Number.isFinite(final) || final < 0 || final > 100)) {
      throw new Error("Academy Nexus returned an invalid GenAI interview final score");
    }
    return { ...parsed.data, candidateId: source.candidateId.trim() };
  });
  return { results, nextCursor: page.nextCursor as string | null };
}

export async function fetchGenaiNexusInterviews(apiKey: string, fetcher: typeof fetch = fetch): Promise<GenaiNexusInterview[]> {
  const all: GenaiNexusInterview[] = [];
  const cursors = new Set<string>();
  const ids = new Set<string>();
  let cursor: string | null = null;
  const deadline = Date.now() + 180_000;
  do {
    if (Date.now() > deadline || cursors.size > 1000) throw new Error("Academy Nexus GenAI sync exceeded its time or page limit");
    const url = new URL("https://academy-nexus-gray.vercel.app/api/interview-results");
    url.searchParams.set("template", GENAI_NEXUS_TEMPLATE);
    url.searchParams.set("limit", "500");
    if (cursor) url.searchParams.set("cursor", cursor);
    let response: Response | undefined;
    for (let retry = 0; retry < 3; retry++) {
      response = await fetcher(url, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(25_000),
        redirect: "error",
      });
      if (response.status < 500 || retry === 2) break;
      await response.arrayBuffer();
      await new Promise((resolve) => setTimeout(resolve, 500 * (retry + 1)));
    }
    if (!response?.ok) throw new Error(`Academy Nexus GenAI fetch failed (HTTP ${response?.status ?? "unknown"})`);
    const page = parseGenaiNexusPage(await response.json());
    for (const result of page.results) {
      if (ids.has(result.interviewId)) throw new Error("Academy Nexus returned duplicate GenAI interview IDs; retry the sync");
      ids.add(result.interviewId);
      all.push(result);
    }
    cursor = page.nextCursor;
    if (cursor) {
      if (cursors.has(cursor)) throw new Error("Academy Nexus returned a repeated pagination cursor");
      cursors.add(cursor);
    }
  } while (cursor);
  return all;
}
