import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessGrantsPanel } from "./AccessGrantsPanel";

const summary = {
  id: 50,
  name: "Gen Ai assessment 22nd november",
  stage: "genai_assessment",
  linkKind: "main",
  url: "https://assessment.topin.tech/assessment?org_id=example",
  enabled: true,
  startsAt: "2026-11-22T09:30:00.000Z",
  expiresAt: "2026-11-22T11:30:00.000Z",
  expired: false,
  scheduled: true,
  userCount: 2,
  createdBy: "api_key",
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
};
const detail = { ...summary, academyUserIds: ["academy-user-1", "academy-user-2"] };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const localDateTime = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AccessGrantsPanel duplicate action", () => {
  it("prefills a reviewable copy, including the roster, without creating it", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/50")) return json({ batch: detail });
      return json({ batches: [summary] });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AccessGrantsPanel apiKey="test-key" />);

    fireEvent.click(await screen.findByRole("button", { name: "Duplicate Gen Ai assessment 22nd november" }));

    const message = await screen.findByTestId("duplicate-draft-message");
    expect(message.textContent).toContain("with 2 students");
    expect(message.textContent)
      .toContain("Nothing is created until you review and save");
    expect((screen.getByLabelText("Stage") as HTMLSelectElement).value).toBe("genai_assessment");
    expect((screen.getByLabelText("Batch name (optional)") as HTMLInputElement).value)
      .toBe("Gen Ai assessment 22nd november (copy)");
    expect((screen.getByLabelText("Main exam link") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Next: Link & timing" }));
    expect((screen.getByLabelText(/Access URL/) as HTMLInputElement).value).toBe(summary.url);
    expect((screen.getByLabelText(/Start time/) as HTMLInputElement).value).toBe(localDateTime(summary.startsAt));
    expect((screen.getByLabelText(/End time/) as HTMLInputElement).value).toBe(localDateTime(summary.expiresAt));
    fireEvent.click(screen.getByRole("button", { name: "Next: Add users" }));
    expect((screen.getByPlaceholderText(/academy_user_id/) as HTMLTextAreaElement).value)
      .toBe("academy-user-1\nacademy-user-2");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("shows an error and leaves the current wizard unchanged when detail cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/50") ? json({ error: "Batch not found" }, 404) : json({ batches: [summary] }),
    ));
    render(<AccessGrantsPanel apiKey="test-key" />);
    fireEvent.click(await screen.findByRole("button", { name: "Duplicate Gen Ai assessment 22nd november" }));
    expect(await screen.findByText("Batch not found")).not.toBeNull();
    expect(screen.queryByTestId("duplicate-draft-message")).toBeNull();
    expect((screen.getByLabelText("Stage") as HTMLSelectElement).value).toBe("online_assessment");
  });
});
