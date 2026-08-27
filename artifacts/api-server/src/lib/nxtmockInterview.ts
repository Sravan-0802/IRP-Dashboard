import {
  db,
  academyUserNxtmockDetailsTable,
  irpL1RoundWiseSummaryTable,
  studentsTable,
} from "@workspace/db";
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
  attemptNumber: number | null;
  interviewStatus: string | null;
  cleared: boolean;
};

export function isNxtmockCleared(
  averageRating: number | null | undefined,
  interviewStatus?: string | null,
): boolean {
  if (interviewStatus && /qualified/i.test(interviewStatus) && !/not\s*qualified/i.test(interviewStatus)) {
    return true;
  }
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
    attemptNumber: row.attemptNumber ?? null,
    interviewStatus: row.interviewStatus ?? null,
    cleared: isNxtmockCleared(row.averageRating, row.interviewStatus),
  };
}

/**
 * Prefer round-wise for Attempt N / status / avg rating; skill bars from detail
 * (section_wise_rating_json synced into discrete columns).
 */
export async function getNxtmockInterviewForUser(
  userId: string,
): Promise<NxtmockInterviewResponse | null> {
  const [detailRows, summaryRows] = await Promise.all([
    db
      .select()
      .from(academyUserNxtmockDetailsTable)
      .where(eq(academyUserNxtmockDetailsTable.userId, userId))
      .orderBy(desc(academyUserNxtmockDetailsTable.syncedAt)),
    db
      .select()
      .from(irpL1RoundWiseSummaryTable)
      .where(eq(irpL1RoundWiseSummaryTable.userId, userId))
      .limit(1),
  ]);

  const summary = summaryRows[0];
  const hasRoundWiseNxtmock =
    summary != null &&
    (summary.nxtmockStatus != null ||
      summary.nxtmockAttemptNumber != null ||
      summary.nxtmockInterviewRating != null);

  const bestDetail =
    detailRows.length === 0
      ? null
      : detailRows.reduce((current, candidate) => {
          const currentAvg = current.averageRating ?? -Infinity;
          const candidateAvg = candidate.averageRating ?? -Infinity;
          if (candidateAvg > currentAvg) return candidate;
          if (candidateAvg < currentAvg) return current;
          const currentAttempt = current.attemptNumber ?? -1;
          const candidateAttempt = candidate.attemptNumber ?? -1;
          if (candidateAttempt > currentAttempt) return candidate;
          if (candidateAttempt < currentAttempt) return current;
          const currentSynced = current.syncedAt?.getTime() ?? 0;
          const candidateSynced = candidate.syncedAt?.getTime() ?? 0;
          return candidateSynced > currentSynced ? candidate : current;
        });

  if (!hasRoundWiseNxtmock && !bestDetail) return null;

  if (hasRoundWiseNxtmock && summary) {
    const skills = bestDetail
      ? {
          selfIntroRating: bestDetail.selfIntroRating,
          javascriptCodingRating: bestDetail.javascriptCodingRating,
          javascriptRating: bestDetail.javascriptRating,
          cssRating: bestDetail.cssRating,
          htmlRating: bestDetail.htmlRating,
          reactJsRating: bestDetail.reactJsRating,
        }
      : {
          selfIntroRating: null,
          javascriptCodingRating: null,
          javascriptRating: null,
          cssRating: null,
          htmlRating: null,
          reactJsRating: null,
        };

    const averageRating =
      summary.nxtmockInterviewRating ?? bestDetail?.averageRating ?? null;
    const interviewStatus =
      summary.nxtmockStatus ?? bestDetail?.interviewStatus ?? null;

    return {
      interviewId: bestDetail?.interviewId ?? "round-wise:nxtmock",
      interviewTitle:
        bestDetail?.interviewTitle ??
        (summary.nxtmockInterviewNumber
          ? `AI Mock Interview ${summary.nxtmockInterviewNumber}`
          : "AI Mock Interview"),
      examType: bestDetail?.examType ?? null,
      level: bestDetail?.level ?? "L1",
      cycle: summary.nxtmockInterviewNumber ?? bestDetail?.cycle ?? null,
      ...skills,
      averageRating,
      attemptNumber:
        summary.nxtmockAttemptNumber ?? bestDetail?.attemptNumber ?? null,
      interviewStatus,
      cleared: isNxtmockCleared(averageRating, interviewStatus),
    };
  }

  return bestDetail ? rowToResponse(bestDetail) : null;
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
