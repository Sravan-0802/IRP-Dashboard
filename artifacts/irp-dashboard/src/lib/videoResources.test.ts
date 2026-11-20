import { describe, expect, it } from "vitest";
import {
  VIDEO_RESOURCES,
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
});
