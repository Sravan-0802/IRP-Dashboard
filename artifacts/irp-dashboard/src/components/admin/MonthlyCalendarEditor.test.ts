import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { monthPrefix } from "@/lib/programBoard";
import { MonthlyCalendarEditor } from "./MonthlyCalendarEditor";
import type { CalendarEvent } from "@/lib/programBoard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function showEditor(events: CalendarEvent[], onEvents: (events: CalendarEvent[]) => void) {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response("[]", { status: 200, headers: { "content-type": "application/json" } })));
  render(React.createElement(MonthlyCalendarEditor, {
    events,
    apiKey: "test-key",
    updatedAt: null,
    author: "Test admin",
    dirty: false,
    onAuthorChange: vi.fn(),
    onRestored: vi.fn(),
    onEvents,
  }));
}

it("discards a slow file read when the admin changes month before it completes", async () => {
  const changed = vi.fn();
  showEditor([], changed);
  let finishRead: (value: string) => void = () => {};
  const delayed = new Promise<string>((resolve) => { finishRead = resolve; });
  const file = new File(["test"], "schedule.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: () => delayed });
  fireEvent.change(screen.getByTestId("input-calendar-csv"), { target: { files: [file] } });
  fireEvent.click(screen.getByTestId("button-admin-calendar-next"));
  const now = new Date();
  await act(async () => {
    finishRead(`Assessment Name,Assessment Date,Assessment Mode,Assessment Link\nExam,${monthPrefix(now.getFullYear(), now.getMonth())}-12,Online,https://example.com\n`);
    await delayed;
  });
  expect(screen.queryByTestId("panel-calendar-import-preview")).toBeNull();
  expect(changed).not.toHaveBeenCalled();
});

it("shows ten assessment rows per page and removes entries without leaving a stale page", () => {
  const now = new Date();
  const prefix = monthPrefix(now.getFullYear(), now.getMonth());
  const initial: CalendarEvent[] = Array.from({ length: 12 }, (_, i) => ({
    id: `row-${i + 1}`,
    date: `${prefix}-${String(i + 1).padStart(2, "0")}`,
    program: "irp",
    label: `Assessment ${i + 1}`,
    mode: "online",
    link: `https://example.com/${i + 1}`,
  }));

  function Harness() {
    const [events, setEvents] = useState(initial);
    return React.createElement(MonthlyCalendarEditor, {
      events,
      apiKey: "test-key",
      updatedAt: null,
      author: "Test admin",
      dirty: false,
      onAuthorChange: vi.fn(),
      onRestored: vi.fn(),
      onEvents: setEvents,
    });
  }

  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response("[]", { status: 200, headers: { "content-type": "application/json" } })));
  render(React.createElement(Harness));
  expect(screen.getAllByTestId(/^row-calendar-assessment-/)).toHaveLength(10);
  expect(screen.getByTestId("text-admin-calendar-page")).toHaveProperty("textContent", "Page 1 of 2");

  fireEvent.click(screen.getByTestId("button-admin-calendar-next-page"));
  expect(screen.getAllByTestId(/^row-calendar-assessment-/)).toHaveLength(2);
  fireEvent.click(screen.getByTestId("button-delete-assessment-row-12"));
  fireEvent.click(screen.getByTestId("button-delete-assessment-row-11"));

  expect(screen.queryByTestId("text-admin-calendar-page")).toBeNull();
  expect(screen.getAllByTestId(/^row-calendar-assessment-/)).toHaveLength(10);
  expect(screen.getByTestId("text-admin-calendar-counts")).toHaveProperty("textContent", expect.stringContaining("10 in"));
});
