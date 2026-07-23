import { NXTMOCK_CLEAR_RATING_THRESHOLD } from "@/lib/nxtmockInterview";

/**
 * IRP 2.0 NxtMock / AI Mock Interview — shown to students who cleared FE Project.
 *
 * Main Interview = timed live interview window.
 * Mock Interview = practice / mock link (separate from Main).
 */
export const NXTMOCK_MAIN_URL =
  "https://nxtinterview.ccbp.in/interview/b8d5933f-c9c0-4373-b1ca-00b9ce595d09";

export const NXTMOCK_MAIN_TITLE = "Main Interview";

export const NXTMOCK_MAIN_LABEL = "Start Main Interview";

/** Window shown on the dashboard callout (IST). */
export const NXTMOCK_MAIN_WINDOW_LABEL =
  "25 Jul 2026, 10:00 AM – 26 Jul 2026, 10:00 PM IST";

export const NXTMOCK_MAIN_WINDOW_HINT =
  "Open only during this window: 10:00 AM (25 Jul) to 10:00 PM (26 Jul) IST.";

/** Practice / mock interview link (not the timed Main Interview). */
export const NXTMOCK_MOCK_URL =
  "https://nxtinterview.ccbp.in/interview/67b87057-99ab-4db4-811c-48fa2620b515";

/** @deprecated Prefer NXTMOCK_MOCK_URL — kept for older imports. */
export const NXTMOCK_MAIN_II_URL = NXTMOCK_MOCK_URL;

export const NXTMOCK_MOCK_TITLE = "Mock Interview";

export const NXTMOCK_MOCK_LABEL = "Start Mock Interview";

export const NXTMOCK_MOCK_HINT =
  "Practice mock link — use this for practice. This is not the Main Interview.";

/** @deprecated Prefer NXTMOCK_MOCK_TITLE */
export const NXTMOCK_MAIN_II_TITLE = NXTMOCK_MOCK_TITLE;

/** @deprecated Prefer NXTMOCK_MOCK_LABEL */
export const NXTMOCK_MAIN_II_LABEL = NXTMOCK_MOCK_LABEL;

export const NXTMOCK_MAIN_II_BODY =
  "You cleared the FE Project. Use the Main Interview link in the timed window, or the Mock Interview link to practice.";

export const NXTMOCK_REATTEMPT_LABEL = "Re-attempt interview";

export const NXTMOCK_REATTEMPT_BODY =
  "You attempted the AI Mock Interview but have not cleared yet. Use Main Interview in the window below, or the Mock Interview link to practice — average rating 5+ is required.";

export const NXTMOCK_RESULTS_TITLE = "AI Mock Interview Results";

export const NXTMOCK_CLEARED_TITLE = "You cleared the AI Mock Interview";

export const NXTMOCK_CLEARED_BODY =
  "Great work. Prepare for your Human Interview — the next step in your IRP journey.";

export const NXTMOCK_NOT_CLEARED_EYEBROW = "AI Mock Interview · Not cleared yet";

export const NXTMOCK_NOT_CLEARED_TITLE = "Keep preparing — re-attempt coming soon";

export const NXTMOCK_NOT_CLEARED_BODY =
  "Your re-attempt date will be announced soon. Stay tuned to your dashboard for updates.";

export const NXTMOCK_CLEAR_REQUIREMENT_LABEL = `Required · ${NXTMOCK_CLEAR_RATING_THRESHOLD}+ average rating`;
