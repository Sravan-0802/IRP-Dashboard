import { describe, expect, it } from "vitest";
import {
  VIDEO_RESOURCES,
  resourcesForFilter,
  showSection,
} from "./videoResources";

describe("videoResources", () => {
  it("includes loom, youtube, instagram, and mentorship items", () => {
    const filters = new Set(VIDEO_RESOURCES.map((item) => item.filter));
    expect(filters).toEqual(new Set(["howto", "youtube", "instagram", "mentorship"]));
    expect(VIDEO_RESOURCES.some((item) => item.url.includes("drive.google.com"))).toBe(true);
    expect(VIDEO_RESOURCES.filter((item) => item.filter === "mentorship")).toHaveLength(3);
  });

  it("filters resources by tab", () => {
    expect(resourcesForFilter("youtube").every((item) => item.filter === "youtube")).toBe(true);
    expect(resourcesForFilter("all")).toHaveLength(VIDEO_RESOURCES.length);
  });

  it("shows the matching section for each filter", () => {
    expect(showSection("all", "instagram")).toBe(true);
    expect(showSection("youtube", "youtube")).toBe(true);
    expect(showSection("youtube", "instagram")).toBe(false);
  });
});
