import { describe, expect, it } from "vitest";
import type { Journey } from "@/lib/journey";
import { l1HustlerJourneySteps } from "@/lib/l1JourneySteps";
import {
  parseTrackStatus,
  withTrackHumanInterview,
  type MernTrackStatus,
} from "@/lib/trackStatus";

const journey = (journeyState: Journey["journeyState"] = "L1_PREP"): Journey => ({
  journeyState,
  isWildcard: false,
  hasCompletedOnboarding: true,
  hasAttemptedL1: false,
  l3ExamStarted: false,
  reattemptDate: null,
  projectSubmitted: false,
  projectDueDate: null,
});

const track = (over: Partial<MernTrackStatus> = {}): MernTrackStatus => ({
  onlineAssessment: "ACTIVE",
  feProject: "NOT_ATTEMPTED",
  humanInterview: "NOT_ATTEMPTED",
  ...over,
});

const visible = { onlineL1Results: true, humanInterviewResults: true };
const stepsFor = (t: MernTrackStatus | null, state?: Journey["journeyState"]) =>
  l1HustlerJourneySteps(journey(state), [], null, visible, null, "student-1", t).map((s) => [
    s.label,
    s.status,
    s.badgeLabel,
  ]);

describe("parseTrackStatus", () => {
  it("returns the stored results for a complete irp_v2 answer", () => {
    expect(
      parseTrackStatus({
        source: "irp_v2",
        mern: { onlineAssessment: "QUALIFIED", feProject: "ACTIVE", humanInterview: null, calculatedAt: null },
      }),
    ).toEqual({ onlineAssessment: "QUALIFIED", feProject: "ACTIVE", humanInterview: null });
  });

  it("returns null (old logic) when the server says legacy", () => {
    expect(parseTrackStatus({ source: "legacy", mern: null, reason: "disabled" })).toBeNull();
  });

  it("returns null for malformed or unknown values", () => {
    expect(parseTrackStatus(null)).toBeNull();
    expect(parseTrackStatus({ source: "irp_v2" })).toBeNull();
    expect(
      parseTrackStatus({ source: "irp_v2", mern: { onlineAssessment: "LOCKED", feProject: "ACTIVE" } }),
    ).toBeNull();
  });
});

describe("l1HustlerJourneySteps with stored results", () => {
  it("keeps the old result when no stored results are given", () => {
    expect(stepsFor(null)).toEqual(l1HustlerJourneySteps(journey(), [], null, visible, null, "student-1").map((s) => [s.label, s.status, s.badgeLabel]));
  });

  it("nothing attempted: assessment active, the rest locked", () => {
    expect(stepsFor(track())).toEqual([
      ["Online Assessment", "active", undefined],
      ["FE Project", "locked", undefined],
      ["Human Interview", "locked", undefined],
      ["Level 2 Access", "locked", undefined],
    ]);
  });

  it("assessment qualified opens the FE Project", () => {
    expect(stepsFor(track({ onlineAssessment: "QUALIFIED", feProject: "ACTIVE" })).slice(0, 2)).toEqual([
      ["Online Assessment", "done", "Qualified"],
      ["FE Project", "active", "In progress"],
    ]);
  });

  it("assessment not qualified keeps the FE Project locked", () => {
    expect(stepsFor(track({ onlineAssessment: "NOT_QUALIFIED" })).slice(0, 2)).toEqual([
      ["Online Assessment", "attempted_not_cleared", "Not qualified"],
      ["FE Project", "locked", undefined],
    ]);
  });

  it("FE not qualified shows not cleared; FE qualified opens the interview", () => {
    expect(stepsFor(track({ onlineAssessment: "QUALIFIED", feProject: "NOT_QUALIFIED" }))[1]).toEqual([
      "FE Project", "attempted_not_cleared", "Not cleared",
    ]);
    expect(stepsFor(track({ onlineAssessment: "QUALIFIED", feProject: "QUALIFIED", humanInterview: "ACTIVE" })).slice(1, 3)).toEqual([
      ["FE Project", "done", "Cleared"],
      ["Human Interview", "active", "In progress"],
    ]);
  });

  it("a result still pending counts as in progress, not as a fail", () => {
    expect(stepsFor(track({ onlineAssessment: "RESULT_PENDING" }))[0]).toEqual([
      "Online Assessment", "active", undefined,
    ]);
  });

  it("reattempt phase still wins over the stored result", () => {
    expect(stepsFor(track({ onlineAssessment: "NOT_QUALIFIED" }), "L1_REATTEMPT_WAITING")[0][1]).toBe("reattempt");
  });
});

describe("withTrackHumanInterview", () => {
  const base = l1HustlerJourneySteps(journey(), [], null, visible, null, "student-1",
    track({ onlineAssessment: "QUALIFIED", feProject: "QUALIFIED" }));
  const hi = (t: MernTrackStatus) => withTrackHumanInterview(base, t).find((s) => s.label === "Human Interview");

  it("shows cleared / not cleared from the stored result", () => {
    expect(hi(track({ humanInterview: "QUALIFIED" }))).toMatchObject({ status: "done", badgeLabel: "Cleared" });
    expect(hi(track({ humanInterview: "NOT_QUALIFIED" }))).toMatchObject({ status: "attempted_not_cleared", badgeLabel: "Not cleared" });
  });

  it("leaves the step alone when not released or not decided", () => {
    expect(hi(track({ humanInterview: null }))).toMatchObject({ status: "active" });
    expect(hi(track({ humanInterview: "ACTIVE" }))).toMatchObject({ status: "active" });
  });
});
