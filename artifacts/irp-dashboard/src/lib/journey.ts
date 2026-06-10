export type JourneyState =
  | "L1_PREP"
  | "L1_EXAM_OPEN"
  | "L1_REATTEMPT_WAITING"
  | "L1_REATTEMPT_ACTIVE"
  | "L1_POST_ASSESSMENT"
  | "L1_POST_REATTEMPT_WAITING"
  | "L1_POST_REATTEMPT_ACTIVE"
  | "L2_PREP"
  | "L2_EXAM_OPEN"
  | "L2_REATTEMPT_WAITING"
  | "L2_REATTEMPT_ACTIVE"
  | "L2_POST_ASSESSMENT"
  | "L2_POST_REATTEMPT_WAITING"
  | "L2_POST_REATTEMPT_ACTIVE"
  | "L3_PREP"
  | "L3_EXAM_OPEN"
  | "L3_REATTEMPT_WAITING"
  | "L3_REATTEMPT_ACTIVE"
  | "L3_POST_ASSESSMENT"
  | "L3_POST_REATTEMPT_WAITING"
  | "L3_POST_REATTEMPT_ACTIVE"
  | "WILDCARD_ACTIVE"
  | "PLACED";

export interface Journey {
  journeyState: JourneyState;
  isWildcard: boolean;
  hasCompletedOnboarding: boolean;
  hasAttemptedL1: boolean;
  l3ExamStarted: boolean;
  reattemptDate: string | null;
  projectSubmitted: boolean;
  projectDueDate: string | null;
}

/** High-level UI phase that a state maps onto. */
export type Phase =
  | "PREP"
  | "EXAM_OPEN"
  | "REATTEMPT_WAITING"
  | "REATTEMPT_ACTIVE"
  | "POST_ASSESSMENT"
  | "WILDCARD"
  | "PLACED";

export function getLevel(state: JourneyState): 1 | 2 | 3 {
  if (state.startsWith("L2_")) return 2;
  if (state.startsWith("L3_")) return 3;
  // L1_*, WILDCARD_ACTIVE, PLACED, or anything unrecognized default to L1.
  return 1;
}

export function getPhase(state: JourneyState): Phase {
  if (state === "PLACED") return "PLACED";
  if (state === "WILDCARD_ACTIVE") return "WILDCARD";
  if (state.endsWith("_PREP")) return "PREP";
  if (state.endsWith("_EXAM_OPEN")) return "EXAM_OPEN";
  if (state.endsWith("_REATTEMPT_WAITING") || state.endsWith("_POST_REATTEMPT_WAITING"))
    return "REATTEMPT_WAITING";
  if (state.endsWith("_REATTEMPT_ACTIVE") || state.endsWith("_POST_REATTEMPT_ACTIVE"))
    return "REATTEMPT_ACTIVE";
  if (state.endsWith("_POST_ASSESSMENT")) return "POST_ASSESSMENT";
  return "PREP";
}

export const LEVEL_META: Record<1 | 2 | 3, { name: string; tag: string }> = {
  1: { name: "Level 1", tag: "The Hustler" },
  2: { name: "Level 2", tag: "The Main Character" },
  3: { name: "Level 3", tag: "Infinite Aura" },
};

export function levelLabel(state: JourneyState): string {
  const lvl = getLevel(state);
  return `${LEVEL_META[lvl].name} · ${LEVEL_META[lvl].tag}`;
}

/** Ordered states for the admin / preview selector. */
export const STANDARD_STATES: JourneyState[] = [
  "L1_PREP",
  "L1_EXAM_OPEN",
  "L1_REATTEMPT_WAITING",
  "L1_REATTEMPT_ACTIVE",
  "L1_POST_ASSESSMENT",
  "L2_PREP",
  "L2_EXAM_OPEN",
  "L2_REATTEMPT_WAITING",
  "L2_POST_ASSESSMENT",
  "L3_PREP",
  "L3_EXAM_OPEN",
  "L3_REATTEMPT_WAITING",
  "L3_POST_ASSESSMENT",
  "PLACED",
];

export const WILDCARD_STATES: JourneyState[] = [
  "WILDCARD_ACTIVE",
  "L3_EXAM_OPEN",
  "L3_REATTEMPT_WAITING",
  "L3_POST_ASSESSMENT",
  "PLACED",
];
