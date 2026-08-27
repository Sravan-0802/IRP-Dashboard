/** Minimum average rating (inclusive) to clear the AI Mock Interview. */
export const NXTMOCK_CLEAR_RATING_THRESHOLD = 5;

export const NXTMOCK_RATING_MAX = 10;

export type NxtmockInterview = {
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
  attemptNumber?: number | null;
  interviewStatus?: string | null;
  cleared: boolean;
};

export type NxtmockInterviewResponse = {
  interview: NxtmockInterview | null;
};

export function isNxtmockCleared(interview: NxtmockInterview | null | undefined): boolean {
  if (!interview) return false;
  if (interview.cleared === true) return true;
  const status = interview.interviewStatus;
  if (status && /qualified/i.test(status) && !/not\s*qualified/i.test(status)) return true;
  return (
    interview.averageRating != null &&
    interview.averageRating >= NXTMOCK_CLEAR_RATING_THRESHOLD
  );
}

export function hasNxtmockAttempt(interview: NxtmockInterview | null | undefined): boolean {
  return interview != null;
}

export function nxtmockRatingPct(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.round((value / NXTMOCK_RATING_MAX) * 100));
}

export function formatNxtmockRating(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
