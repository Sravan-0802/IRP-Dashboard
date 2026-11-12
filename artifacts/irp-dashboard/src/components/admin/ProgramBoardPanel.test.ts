import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROGRAM_BOARD } from "@/lib/programBoard";
import { ProgramBoardPanel } from "./ProgramBoardPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProgramBoardPanel", () => {
  it("adds a calendar chip at the top and focuses its date field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => DEFAULT_PROGRAM_BOARD,
      }),
    );
    render(React.createElement(ProgramBoardPanel, { apiKey: "test-key" }));

    fireEvent.click(await screen.findByRole("button", { name: "Assessment Calendar" }));
    const chips = screen.getByRole("heading", { name: "Calendar chips" }).parentElement!.parentElement!;
    fireEvent.click(within(chips).getByRole("button", { name: "Add" }));

    expect(screen.getAllByLabelText("Label")[0]).toHaveProperty("value", "New event");
    expect(document.activeElement).toBe(screen.getAllByLabelText("Date")[0]);
  });
});
