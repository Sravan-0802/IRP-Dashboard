import { GetHumanInterviewResultsResponse } from "@workspace/api-zod";

const attemptSchema = GetHumanInterviewResultsResponse.shape.attempts.element;
export type InterviewAttempt = ReturnType<typeof attemptSchema.parse>;
export type NexusInterview = InterviewAttempt & { candidateId: string };

/** The upstream status is authoritative; unknown statuses are never completed. */
export function isScoredInterview(attempt: InterviewAttempt): boolean {
  return attempt.finalScore !== null &&
    (attempt.clearanceStatus === "Cleared" || attempt.clearanceStatus === "Not Cleared");
}

export function interviewTimestamp(attempt: InterviewAttempt): number {
  if (!attempt.interviewDate) return -1;
  const match = attempt.interviewStartTime.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  let hour = match ? Number(match[1]) : 0;
  const minute = match ? Number(match[2]) : 0;
  if (match?.[3]) hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  const date = Date.parse(`${attempt.interviewDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`);
  return Number.isFinite(date) ? date : -1;
}

export function summarizeInterviews<T extends InterviewAttempt>(rows: T[]) {
  const attempts = [...rows].sort((a, b) =>
    interviewTimestamp(b) - interviewTimestamp(a) || a.interviewId.localeCompare(b.interviewId));
  return { attempts, latestResult: attempts.find(isScoredInterview) ?? null };
}

export function parseNexusPage(value: unknown): { results: NexusInterview[]; nextCursor: string | null } {
  if (!value || typeof value !== "object") throw new Error("Academy Nexus returned an invalid page");
  const page = value as Record<string, unknown>;
  if (page.template !== "irp-l1" || !Array.isArray(page.results) ||
      page.count !== page.results.length ||
      (page.nextCursor !== null && (typeof page.nextCursor !== "string" || !page.nextCursor))) {
    throw new Error("Academy Nexus returned an invalid IRP L1 page");
  }
  const results = page.results.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("Academy Nexus returned an invalid interview");
    const source = raw as Record<string, unknown>;
    if (typeof source.candidateId !== "string" || !source.candidateId.trim()) {
      throw new Error("Academy Nexus returned an interview without an Academy UID");
    }
    const parsed = attemptSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.interviewId.trim()) {
      throw new Error("Academy Nexus returned invalid interview result fields");
    }
    for (const score of [parsed.data.part1Avg, parsed.data.part2Avg, parsed.data.part3Avg,
      parsed.data.communicationRating, parsed.data.finalScore]) {
      if (score !== null && (!Number.isFinite(score) || score < 0 || score > 5)) {
        throw new Error("Academy Nexus returned an invalid interview score");
      }
    }
    return { ...parsed.data, candidateId: source.candidateId.trim() };
  });
  return { results, nextCursor: page.nextCursor as string | null };
}

export async function fetchNexusInterviews(apiKey: string, fetcher: typeof fetch = fetch): Promise<NexusInterview[]> {
  const all: NexusInterview[] = [];
  const cursors = new Set<string>();
  const ids = new Set<string>();
  let cursor: string | null = null;
  const deadline = Date.now() + 180_000;
  do {
    if (Date.now() > deadline || cursors.size > 1000) throw new Error("Academy Nexus sync exceeded its time or page limit");
    const url = new URL("https://academy-nexus-gray.vercel.app/api/interview-results");
    url.searchParams.set("template", "irp-l1");
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
    if (!response?.ok) throw new Error(`Academy Nexus fetch failed (HTTP ${response?.status ?? "unknown"})`);
    const page = parseNexusPage(await response.json());
    for (const result of page.results) {
      if (ids.has(result.interviewId)) throw new Error("Academy Nexus returned duplicate interview IDs; retry the sync");
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
