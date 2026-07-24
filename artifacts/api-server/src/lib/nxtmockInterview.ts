import { db, academyUserNxtmockDetailsTable, studentsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

/** Minimum average rating (inclusive) to clear the AI Mock Interview. */
export const NXTMOCK_CLEAR_RATING_THRESHOLD = 5;

export type NxtmockInterviewResponse = {
  interviewId: string;
  interviewTitle: string | null;
  examType: string | null;
  level: string | null;
  cycle: string | null;
  selfIntroRating: number | null;
  javascriptCodingRating: number | null;
  javascriptRating: number | null;
  cssRating: number | null;
  htmlRating: number | null;
  reactJsRating: number | null;
  averageRating: number | null;
  cleared: boolean;
};

export function isNxtmockCleared(averageRating: number | null | undefined): boolean {
  return averageRating != null && averageRating >= NXTMOCK_CLEAR_RATING_THRESHOLD;
}

function rowToResponse(
  row: typeof academyUserNxtmockDetailsTable.$inferSelect,
): NxtmockInterviewResponse {
  return {
    interviewId: row.interviewId,
    interviewTitle: row.interviewTitle,
    examType: row.examType,
    level: row.level,
    cycle: row.cycle,
    selfIntroRating: row.selfIntroRating,
    javascriptCodingRating: row.javascriptCodingRating,
    javascriptRating: row.javascriptRating,
    cssRating: row.cssRating,
    htmlRating: row.htmlRating,
    reactJsRating: row.reactJsRating,
    averageRating: row.averageRating,
    cleared: isNxtmockCleared(row.averageRating),
  };
}

/** Latest synced row per user, preferring the highest average rating when multiple exist. */
export async function getNxtmockInterviewForUser(
  userId: string,
): Promise<NxtmockInterviewResponse | null> {
  const rows = await db
    .select()
    .from(academyUserNxtmockDetailsTable)
    .where(eq(academyUserNxtmockDetailsTable.userId, userId))
    .orderBy(desc(academyUserNxtmockDetailsTable.syncedAt));

  if (rows.length === 0) return null;

  const best = rows.reduce((current, candidate) => {
    const currentAvg = current.averageRating ?? -Infinity;
    const candidateAvg = candidate.averageRating ?? -Infinity;
    if (candidateAvg > currentAvg) return candidate;
    if (candidateAvg < currentAvg) return current;
    const currentSynced = current.syncedAt?.getTime() ?? 0;
    const candidateSynced = candidate.syncedAt?.getTime() ?? 0;
    return candidateSynced > currentSynced ? candidate : current;
  });

  return rowToResponse(best);
}

/** Persist L1_HUMAN_INTERVIEW when synced NxtMock data shows a cleared attempt. */
export async function maybeAdvanceJourneyFromNxtmock(
  userId: string,
  student: typeof studentsTable.$inferSelect,
): Promise<typeof studentsTable.$inferSelect> {
  const nxtmock = await getNxtmockInterviewForUser(userId);
  if (!nxtmock?.cleared) return student;

  const state = student.journeyState;
  if (
    state === "L1_HUMAN_INTERVIEW" ||
    state.startsWith("L2_") ||
    state.startsWith("L3_") ||
    state === "PLACED"
  ) {
    return student;
  }

  const [updated] = await db
    .update(studentsTable)
    .set({
      journeyState: "L1_HUMAN_INTERVIEW",
      projectSubmitted: 1,
      hasAttemptedL1: 1,
      hasCompletedOnboarding: 1,
    })
    .where(eq(studentsTable.id, student.id))
    .returning();

  return updated ?? student;
}
