import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROGRAM_BOARD, monthPrefix, type ProgramBoard } from "@/lib/programBoard";
import { ProgramBoardPanel } from "./ProgramBoardPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
function showPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(ProgramBoardPanel, { apiKey: "test-key" })));
  return queryClient;
}
async function openCalendar() {
  fireEvent.click(screen.getByRole("button", { name: "Assessment Calendar" }));
  await screen.findByTestId("button-add-calendar-assessment");
}

describe("ProgramBoardPanel", () => {
  it("adds an assessment and focuses its name field", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(DEFAULT_PROGRAM_BOARD)));
    showPanel();
    await openCalendar();
    fireEvent.click(screen.getByTestId("button-add-calendar-assessment"));
    const name = screen.getByLabelText("Assessment name");
    expect(name).toHaveProperty("value", "");
    await waitFor(() => expect(document.activeElement).toBe(name));
  });

  it("refreshes the generated student calendar query after a successful save", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ...DEFAULT_PROGRAM_BOARD, updatedAt: "2030-01-01T00:00:00.000Z" })));
    const queryClient = showPanel();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() => expect((screen.getByTestId("button-save-program-board") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId("button-save-program-board"));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["/api/student/program-board"] }));
    expect(await screen.findByTestId("text-program-board-saved")).toHaveProperty("textContent", expect.stringContaining("Saved at"));
  });

  it("does not permit an empty draft to overwrite the server after a failed initial load", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Load unavailable" }, 500)));
    showPanel();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Load unavailable");
    expect((screen.getByTestId("button-save-program-board") as HTMLButtonElement).disabled).toBe(true);
  });

  it("imports one month only after confirmation and saves both assessments and untouched months", async () => {
    const today = new Date();
    const prefix = monthPrefix(today.getFullYear(), today.getMonth());
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const otherDate = `${monthPrefix(next.getFullYear(), next.getMonth())}-10`;
    const initial: ProgramBoard = {
      ...DEFAULT_PROGRAM_BOARD, updatedAt: "2030-01-01T00:00:00.000Z",
      calendar: { upcoming: [], events: [
        { id: "replace", date: `${prefix}-10`, program: "irp", label: "Old" },
        { id: "keep", date: otherDate, program: "irp", label: "Other month" },
      ] },
    };
    let saved: ProgramBoard | undefined;
    const transport = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "PUT") saved = JSON.parse(String(init.body));
      return json(saved ? { ...saved, updatedAt: "2030-01-02T00:00:00.000Z" } : initial);
    });
    vi.stubGlobal("fetch", transport);
    showPanel();
    await openCalendar();
    const file = new File(["test"], "schedule.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () =>
      `Assessment Name,Assessment Date,Assessment Mode,Assessment Link,Program\nFirst,${prefix}-12,Online,https://example.com/first,MERN\nSecond,${prefix}-12,Offline,https://example.com/second,GenAI\n` });
    fireEvent.change(screen.getByTestId("input-calendar-csv"), { target: { files: [file] } });
    await screen.findByTestId("panel-calendar-import-preview");
    expect((screen.getByTestId("button-apply-calendar-import") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("checkbox-confirm-calendar-import"));
    fireEvent.click(screen.getByTestId("button-apply-calendar-import"));
    expect(saved).toBeUndefined();
    fireEvent.click(screen.getByTestId("button-save-program-board"));
    await waitFor(() => expect(saved?.calendar.events).toHaveLength(3));
    expect(saved?.calendar.events.find((e) => e.id === "keep")).toMatchObject(initial.calendar.events[1]);
    expect(saved?.calendar.events.find((e) => e.id === "replace")).toBeUndefined();
    expect(saved?.calendar.events.filter((e) => e.date === `${prefix}-12`).map((e) => [e.label, e.mode, e.link])).toEqual([
      ["First", "online", "https://example.com/first"],
      ["Second", "offline", "https://example.com/second"],
    ]);
  });

  it("keeps a row visible when its date is cleared so the admin can correct it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(DEFAULT_PROGRAM_BOARD)));
    showPanel();
    await openCalendar();
    fireEvent.click(screen.getByTestId("button-add-calendar-assessment"));
    fireEvent.change(screen.getByLabelText("Assessment name"), { target: { value: "Fix me" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
    expect(screen.getByLabelText("Assessment name")).toHaveProperty("value", "Fix me");
    fireEvent.click(screen.getByTestId("button-save-program-board"));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Date must be"));
  });

  it("retains the draft when another admin has saved a newer version", async () => {
    const now = new Date();
    const initial = {
      ...DEFAULT_PROGRAM_BOARD, updatedAt: "2030-01-01T00:00:00.000Z",
      calendar: { upcoming: [], events: [
        { id: "edit", date: `${monthPrefix(now.getFullYear(), now.getMonth())}-12`, program: "irp", label: "Original", mode: "online", link: "https://example.com" },
      ] },
    };
    let expectedTimestamp: string | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "PUT") {
        expectedTimestamp = JSON.parse(String(init.body)).expectedUpdatedAt;
        return json({ error: "Another admin saved a newer schedule. Your draft has been kept." }, 409);
      }
      return json(initial);
    }));
    showPanel();
    await openCalendar();
    fireEvent.change(screen.getByLabelText("Assessment name"), { target: { value: "My unsaved edit" } });
    fireEvent.click(screen.getByTestId("button-save-program-board"));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("draft has been kept"));
    expect(screen.getByLabelText("Assessment name")).toHaveProperty("value", "My unsaved edit");
    expect(expectedTimestamp).toBe(initial.updatedAt);
    expect(screen.queryByTestId("text-program-board-saved")).toBeNull();
  });
});
