import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VideoResources } from "./VideoResources";
import { LOOM_VIDEO_GUIDELINES_URL, drivePreviewUrl } from "@/lib/videoResources";

vi.mock("@/lib/videoResourceAnalytics", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/videoResourceAnalytics")>(),
  trackVideoResourceEvent: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Loom tutorial playback", () => {
  it("opens Google's responsive player directly on phones", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<VideoResources />);
    fireEvent.click(screen.getByTestId("howto-watch-howto-loom-submit"));
    expect(open).toHaveBeenCalledWith(
      drivePreviewUrl(LOOM_VIDEO_GUIDELINES_URL),
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows an unscaled Drive iframe on larger screens with the original-page fallback", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    render(<VideoResources />);
    fireEvent.click(screen.getByTestId("howto-watch-howto-loom-submit"));
    const frame = screen.getByTitle("How to submit your Loom video");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("src")).toBe(drivePreviewUrl(LOOM_VIDEO_GUIDELINES_URL));
    expect(document.querySelector("video")).toBeNull();
    const player = screen.getByTestId("howto-popup-howto-loom-submit-player");
    expect(frame.className).toContain("h-full w-full");
    expect(frame.className).not.toContain("scale-50");
    expect(player.className).not.toContain("@container");
    expect(screen.getByText("Open in a new tab").getAttribute("href")).toBe(LOOM_VIDEO_GUIDELINES_URL);
    fireEvent.click(screen.getByTestId("howto-popup-howto-loom-submit-close"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the iframe with Escape and restores scrolling", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    render(<VideoResources />);
    const previous = document.body.style.overflow;
    fireEvent.click(screen.getByTestId("howto-watch-howto-loom-submit"));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe(previous);
  });
});
