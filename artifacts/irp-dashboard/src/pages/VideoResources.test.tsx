import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VideoResources } from "./VideoResources";
import { LOOM_VIDEO_GUIDELINES_URL, driveStreamUrl } from "@/lib/videoResources";

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
  it("keeps native playback inside the website on phones", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<VideoResources />);
    fireEvent.click(screen.getByTestId("howto-watch-howto-loom-submit"));
    expect(open).not.toHaveBeenCalled();
    const video = screen.getByTestId("howto-popup-howto-loom-submit-video") as HTMLVideoElement;
    expect(video.tagName).toBe("VIDEO");
    expect(video.playsInline).toBe(true);
    expect(video.controls).toBe(true);
    expect(video.getAttribute("src")).toBe(driveStreamUrl(LOOM_VIDEO_GUIDELINES_URL));
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("uses the same unscaled native player on larger screens", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    render(<VideoResources />);
    fireEvent.click(screen.getByTestId("howto-watch-howto-loom-submit"));
    const frame = screen.getByTestId("howto-popup-howto-loom-submit-video");
    expect(frame.tagName).toBe("VIDEO");
    expect(frame.getAttribute("src")).toBe(driveStreamUrl(LOOM_VIDEO_GUIDELINES_URL));
    expect(document.querySelector("iframe")).toBeNull();
    const player = screen.getByTestId("howto-popup-howto-loom-submit-player");
    expect(frame.className).toContain("h-full w-full");
    expect(frame.className).not.toContain("scale-50");
    expect(player.className).not.toContain("@container");
    expect(screen.getByText("Open in a new tab").getAttribute("href")).toBe(LOOM_VIDEO_GUIDELINES_URL);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    fireEvent.click(screen.getByTestId("howto-popup-howto-loom-submit-close"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the player with Escape and restores scrolling", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    render(<VideoResources />);
    const previous = document.body.style.overflow;
    fireEvent.click(screen.getByTestId("howto-watch-howto-loom-submit"));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe(previous);
  });

  it("shows an explicit retry when video loading fails", () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    render(<VideoResources />);
    fireEvent.click(screen.getByTestId("howto-watch-howto-loom-submit"));
    fireEvent.error(screen.getByTestId("howto-popup-howto-loom-submit-video"));
    expect(screen.getByRole("alert").textContent).toContain("Could not load");
    fireEvent.click(screen.getByText("Retry"));
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
  });
});
