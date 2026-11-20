import { describe, expect, it } from "vitest";
import {
  LOOM_VIDEO_GUIDELINES_URL,
  VIDEO_RESOURCES,
  drivePreviewUrl,
  driveStreamUrl,
  resourcesForFilter,
  showSection,
} from "./videoResources";

describe("videoResources", () => {
  it("includes loom and mentorship items only", () => {
    const filters = new Set(VIDEO_RESOURCES.map((item) => item.filter));
    expect(filters).toEqual(new Set(["howto", "mentorship"]));
    expect(VIDEO_RESOURCES.some((item) => item.url.includes("drive.google.com"))).toBe(true);
    expect(VIDEO_RESOURCES.filter((item) => item.filter === "mentorship")).toHaveLength(3);
  });

  it("filters resources by tab", () => {
    expect(resourcesForFilter("mentorship").every((item) => item.filter === "mentorship")).toBe(true);
    expect(resourcesForFilter("all")).toHaveLength(VIDEO_RESOURCES.length);
  });

  it("shows the matching section for each filter", () => {
    expect(showSection("all", "howto")).toBe(true);
    expect(showSection("mentorship", "mentorship")).toBe(true);
    expect(showSection("mentorship", "howto")).toBe(false);
  });

  it("builds Drive preview and stream URLs for playback", () => {
    expect(drivePreviewUrl(LOOM_VIDEO_GUIDELINES_URL)).toBe(
      "https://drive.google.com/file/d/12CnEaVZ9m2Fwr13DRj_AdNyDnek4lrA4/preview",
    );
    expect(driveStreamUrl(LOOM_VIDEO_GUIDELINES_URL)).toBe("/api/media/loom-guidelines");

  });
});
