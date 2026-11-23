import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import { AssessmentAccessGrants } from "./AssessmentAccessGrants";
import { useStudentAccess, type StudentAccessGrant } from "@/lib/useStudentAccess";

vi.mock("@/lib/useStudentAccess", async (load) => ({
  ...await load<typeof import("@/lib/useStudentAccess")>(),
  useStudentAccess: vi.fn(),
}));

const grant = (overrides: Partial<StudentAccessGrant> = {}): StudentAccessGrant => ({
  batchId: 1,
  stage: "genai_assessment",
  linkKind: "mock",
  name: "GenAI assessment 22 November",
  url: "https://assessment.topin.tech/mock",
  startsAt: "2026-11-21T08:30:00Z",
  expiresAt: "2026-11-22T04:30:00Z",
  ...overrides,
});
function show(grants: StudentAccessGrant[], track: "all" | "mern" | "genai" = "all") {
  vi.mocked(useStudentAccess).mockReturnValue({
    grants,
    loading: false,
    findGrant: () => undefined,
  });
  return render(<AssessmentAccessGrants track={track} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("assessment access grants", () => {
  it("shows assigned MERN and GenAI assessments together in the common hub", () => {
    show([
      grant(),
      grant({
        batchId: 2,
        stage: "online_assessment",
        linkKind: "main",
        name: "MERN main assessment",
        url: "https://assessment.topin.tech/mern-main",
        startsAt: "2026-11-21T08:30:00Z",
      }),
    ]);
    expect(screen.getByTestId("card-assessment-grant-1")).not.toBeNull();
    expect(screen.getByTestId("card-assessment-grant-2")).not.toBeNull();
    expect(screen.getByText("Open Main Assessment").getAttribute("href"))
      .toBe("https://assessment.topin.tech/mern-main");
  });

  it("filters MERN and GenAI grants for their respective dashboards", () => {
    const grants = [
      grant(),
      grant({ batchId: 2, stage: "online_assessment", name: "MERN mock" }),
    ];
    const mern = show(grants, "mern");
    expect(screen.getByTestId("card-assessment-grant-2")).not.toBeNull();
    expect(screen.queryByTestId("card-assessment-grant-1")).toBeNull();
    mern.unmount();
    show(grants, "genai");
    expect(screen.getByTestId("card-assessment-grant-1")).not.toBeNull();
    expect(screen.queryByTestId("card-assessment-grant-2")).toBeNull();
  });

  it("keeps a scheduled main assessment locked and displays its IST opening", () => {
    show([grant({
      batchId: 2,
      linkKind: "main",
      url: "",
      startsAt: "2026-11-22T09:30:00Z",
      expiresAt: "2026-11-22T11:30:00Z",
    })]);
    expect((screen.getByTestId("button-assessment-grant-2") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("link-assessment-grant-2")).toBeNull();
    expect(screen.getByText(/Opens 22 Nov 2026, 3:00 pm IST/i)).not.toBeNull();
  });

  it("never exposes a scheduled URL even if one is accidentally returned", () => {
    show([grant({ startsAt: "2026-11-22T09:30:00Z" })]);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hides expired grants and removes a live grant at its expiry boundary", () => {
    show([
      grant({ expiresAt: "2026-11-21T12:00:02Z" }),
      grant({ batchId: 2, expiresAt: "2026-11-20T12:00:00Z" }),
    ]);
    expect(screen.queryByTestId("card-assessment-grant-2")).toBeNull();
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.queryByTestId("card-assessment-grant-1")).toBeNull();
  });

  it("waits for the URL to refresh at the opening boundary before enabling main", () => {
    const main = grant({
      linkKind: "main",
      url: "",
      startsAt: "2026-11-21T12:00:02Z",
    });
    const view = show([main]);
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.queryByRole("link")).toBeNull();
    vi.mocked(useStudentAccess).mockReturnValue({
      grants: [{ ...main, url: "https://assessment.topin.tech/main" }],
      loading: false,
      findGrant: () => undefined,
    });
    view.rerender(<AssessmentAccessGrants />);
    const link = screen.getByText("Open Main Assessment");
    expect(link.getAttribute("href")).toBe("https://assessment.topin.tech/main");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("does not make unsafe assessment URLs clickable or show project links as assessments", () => {
    show([
      grant({ url: "javascript:alert(1)" }),
      grant({ batchId: 2, stage: "genai_project", linkKind: "default" }),
    ]);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByTestId("card-assessment-grant-2")).toBeNull();
  });

  it("shows no cards when the student has no assigned assessments", () => {
    show([]);
    expect(screen.queryByRole("region")).toBeNull();
  });
});
