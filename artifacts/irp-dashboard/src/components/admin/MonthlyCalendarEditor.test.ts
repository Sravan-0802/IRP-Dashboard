import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { monthPrefix } from "@/lib/programBoard";
import { MonthlyCalendarEditor } from "./MonthlyCalendarEditor";

afterEach(cleanup);

it("discards a slow file read when the admin changes month before it completes", async () => {
  const changed = vi.fn();
  render(React.createElement(MonthlyCalendarEditor, { events: [], onEvents: changed }));
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
