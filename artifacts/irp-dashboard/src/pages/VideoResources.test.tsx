import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VideoResources } from "./VideoResources";
import { LOOM_VIDEO_GUIDELINES_URL, drivePreviewUrl } from "@/lib/videoResources";

vi.mock("@/lib/videoResourceAnalytics", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/videoResourceAnalytics")>(),
  trackVideoResourceEvent: vi.fn(),
}));

afterEach(cleanup);

describe("Loom tutorial playback", () => {
  it("opens Google's iframe directly, with the original Drive page as fallback", () => {
    render(<VideoResources />);
    fireEvent.click(screen.getByTestId("howto-watch-howto-loom-submit"));
    const frame = screen.getByTitle("How to submit your Loom video");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("src")).toBe(drivePreviewUrl(LOOM_VIDEO_GUIDELINES_URL));
    expect(document.querySelector("video")).toBeNull();
    expect(screen.getByText("Open in a new tab").getAttribute("href")).toBe(LOOM_VIDEO_GUIDELINES_URL);
    fireEvent.click(screen.getByTestId("howto-popup-howto-loom-submit-close"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the iframe with Escape and restores scrolling", () => {
    render(<VideoResources />);
    const previous = document.body.style.overflow;
    fireEvent.click(screen.getByTestId("howto-watch-howto-loom-submit"));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe(previous);
  });
});
