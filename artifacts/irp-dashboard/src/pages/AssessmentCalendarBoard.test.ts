import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROGRAM_BOARD, monthPrefix, type CalendarEvent, type ProgramBoard } from "@/lib/programBoard";
import { useProgramBoardQuery } from "@/lib/useProgramBoard";
import { AssessmentCalendarBoard } from "./AssessmentCalendarBoard";

vi.mock("@/lib/useProgramBoard", () => ({ useProgramBoardQuery: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function showCalendar(events: CalendarEvent[], upcoming: ProgramBoard["calendar"]["upcoming"] = []) {
  vi.mocked(useProgramBoardQuery).mockReturnValue({
    data: { ...DEFAULT_PROGRAM_BOARD, calendar: { events, upcoming } },
    isLoading: false, isError: false, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useProgramBoardQuery>);
  render(React.createElement(AssessmentCalendarBoard));
}

describe("AssessmentCalendarBoard", () => {
  it("shows exact saved names, modes and individual links for several assessments on one date", () => {
    const now = new Date();
    const date = `${monthPrefix(now.getFullYear(), now.getMonth())}-12`;
    const events: CalendarEvent[] = Array.from({ length: 4 }, (_, i) => ({
      id: `exam-${i}`, date, program: i % 2 ? "genai" : "irp",
      label: `Saved assessment ${i}`, mode: i % 2 ? "offline" : "online",
      link: `https://example.com/assessment-${i}`,
    }));
    showCalendar(events, [{ id: "old", program: "irp", when: "12 to 19 Nov", title: "Old title that must not replace a saved name", detail: "", action: "", badge: "" }]);
    const cell = within(screen.getByTestId(`cell-calendar-${date}`));
    expect(cell.getByTestId("link-assessment-exam-0")).toHaveProperty("href", "https://example.com/assessment-0");
    expect(cell.getByTestId("tag-assessment-mode-exam-1")).toHaveProperty("textContent", "Offline");
    fireEvent.click(screen.getByTestId(`button-calendar-more-${date}`));
    const details = within(screen.getByTestId("calendar-day-details"));
    expect(details.getAllByRole("link")).toHaveLength(4);
    expect(details.getByText("Saved assessment 3")).toBeTruthy();
    for (const [i] of events.entries()) {
      expect(details.getByTestId(`link-open-assessment-exam-${i}`)).toHaveProperty("href", `https://example.com/assessment-${i}`);
    }
    expect(screen.queryByText("Old title that must not replace a saved name")).toBeNull();
  });

  it("navigates by month and year and filters by program", () => {
    const now = new Date();
    const year = now.getFullYear() + 1;
    showCalendar([
      { id: "future", date: `${year}-03-07`, program: "genai", label: "Next year", mode: "online", link: "https://example.com/future" },
      { id: "mern", date: `${year}-03-07`, program: "irp", label: "MERN", mode: "offline", link: "https://example.com/mern" },
    ]);
    fireEvent.change(screen.getByTestId("select-calendar-year"), { target: { value: String(year) } });
    fireEvent.change(screen.getByTestId("select-calendar-month"), { target: { value: "2" } });
    expect(screen.getByTestId("text-month-assessment-count")).toHaveProperty("textContent", "2");
    fireEvent.click(screen.getByTestId("tab-calendar-genai"));
    expect(screen.getByTestId("text-month-assessment-count")).toHaveProperty("textContent", "1");
    expect(within(screen.getByTestId(`cell-calendar-${year}-03-07`)).queryByText("MERN")).toBeNull();
  });

  it("keeps links optional and does not expose raw or unsafe URLs", () => {
    const now = new Date();
    const date = `${monthPrefix(now.getFullYear(), now.getMonth())}-12`;
    showCalendar([
      { id: "legacy", date, program: "irp", label: "Old entry" },
      { id: "unsafe", date, program: "irp", label: "Unsafe", link: "javascript:alert(1)" },
      { id: "private-url", date, program: "irp", label: "Safe URL hidden as text", mode: "online", link: "https://example.com/private-url" },
    ]);
    const cell = within(screen.getByTestId(`cell-calendar-${date}`));
    expect(cell.queryAllByRole("link")).toHaveLength(1);
    expect(cell.getByTestId("link-assessment-private-url")).toHaveProperty("href", "https://example.com/private-url");
    expect(cell.queryByText("https://example.com/private-url")).toBeNull();
    expect(cell.getByText("Old entry")).toBeTruthy();
    expect(cell.getByText("Safe URL hidden as text")).toBeTruthy();
    expect(screen.queryByText("Link pending")).toBeNull();
  });

  it("shows an explicit retry rather than fabricated events when the server fails", () => {
    const retry = vi.fn();
    vi.mocked(useProgramBoardQuery).mockReturnValue({
      data: undefined, isLoading: false, isError: true, refetch: retry,
    } as unknown as ReturnType<typeof useProgramBoardQuery>);
    render(React.createElement(AssessmentCalendarBoard));
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-retry-calendar"));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("calendar-track-banner")).toBeNull();
  });
});
