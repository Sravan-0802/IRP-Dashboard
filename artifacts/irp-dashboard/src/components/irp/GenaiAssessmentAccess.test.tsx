import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GenaiAssessmentAccess } from "./GenaiAssessmentAccess";
import { useStudentAccess, type StudentAccessGrant } from "@/lib/useStudentAccess";
import { act } from "react";

vi.mock("@/lib/useStudentAccess", async (load) => ({
  ...await load<typeof import("@/lib/useStudentAccess")>(),
  useStudentAccess: vi.fn(),
}));

const grant = (overrides: Partial<StudentAccessGrant> = {}): StudentAccessGrant => ({
  batchId: 1, stage: "genai_assessment", linkKind: "mock",
  name: "GenAI assessment 22 November", url: "https://assessment.topin.tech/mock",
  startsAt: "2026-11-21T08:30:00Z", expiresAt: "2026-11-22T04:30:00Z",
  ...overrides,
});
function show(grants: StudentAccessGrant[]) {
  vi.mocked(useStudentAccess).mockReturnValue({
    grants, loading: false, findGrant: () => undefined,
  });
  return render(<GenaiAssessmentAccess />);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("assigned GenAI assessment access", () => {
  it("shows the live mock and locked upcoming main together, with IST times", () => {
    show([grant(), grant({
      batchId: 2, linkKind: "main", url: "",
      startsAt: "2026-11-22T09:30:00Z", expiresAt: "2026-11-22T11:30:00Z",
    })]);
    expect(screen.getByText("Start Mock Assessment").getAttribute("href")).toBe("https://assessment.topin.tech/mock");
    expect(screen.getByTestId("button-genai-access-2").hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("Start Main Assessment")).toBeNull();
    expect(screen.getByText(/Opens 22 Nov 2026, 3:00 pm IST/i)).not.toBeNull();
  });

  it("never exposes a scheduled URL even if one is accidentally returned", () => {
    show([grant({ startsAt: "2026-11-22T09:30:00Z" })]);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows no cards for unassigned students or grants for other stages", () => {
    const view = show([]);
    expect(screen.queryByRole("region")).toBeNull();
    view.unmount();
    show([grant({ stage: "online_assessment" }), grant({ stage: "genai_project", linkKind: "default" })]);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("hides expired cards and removes a live card at its expiry boundary", () => {
    show([grant({ expiresAt: "2026-11-21T12:00:02Z" }), grant({ batchId: 2, expiresAt: "2026-11-20T12:00:00Z" })]);
    expect(screen.queryByTestId("card-genai-access-2")).toBeNull();
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.queryByTestId("card-genai-access-1")).toBeNull();
  });

  it("waits for a newly fetched URL after opening, then enables the main link", () => {
    const main = grant({ linkKind: "main", url: "", startsAt: "2026-11-21T12:00:02Z" });
    const view = show([main]);
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getAllByText(/Checking access/i).length).toBeGreaterThan(0);
    vi.mocked(useStudentAccess).mockReturnValue({
      grants: [{ ...main, url: "https://assessment.topin.tech/main" }],
      loading: false, findGrant: () => undefined,
    });
    view.rerender(<GenaiAssessmentAccess />);
    const link = screen.getByText("Start Main Assessment");
    expect(link.getAttribute("href")).toBe("https://assessment.topin.tech/main");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("does not make unsafe assessment URLs clickable", () => {
    show([grant({ url: "javascript:alert(1)" })]);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
