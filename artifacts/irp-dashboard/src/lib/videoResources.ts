/** Static Video Resources content for the Resource Hub. */

export type VideoFilter = "all" | "howto" | "mentorship";

export type VideoPlatform = "loom" | "ccbp";

export type VideoFormat = "video-guide" | "event";

export type VideoResource = {
  id: string;
  filter: Exclude<VideoFilter, "all">;
  platform: VideoPlatform;
  format: VideoFormat;
  title: string;
  description?: string;
  url: string;
  durationLabel?: string;
};

export const LOOM_VIDEO_GUIDELINES_URL =
  "https://drive.google.com/file/d/12CnEaVZ9m2Fwr13DRj_AdNyDnek4lrA4/view";

/** Extract Google Drive file id from a /file/d/... link. */
export function driveFileId(url: string): string | null {
  return /\/file\/d\/([^/]+)/.exec(url)?.[1] ?? null;
}

/** Google Drive /view links → embeddable /preview URL for in-page playback. */
export function drivePreviewUrl(url: string): string | null {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

/**
 * App stream path for the Loom guide. Served by the API media proxy because Drive
 * sets Cross-Origin-Resource-Policy: same-site and blocks direct <video> loads.
 */
export const LOOM_GUIDE_STREAM_PATH = "/api/media/loom-guidelines";

/** Stream URL for native HTML5 video controls (proxied for Drive-hosted guides). */
export function driveStreamUrl(url: string): string | null {
  const id = driveFileId(url);
  if (!id) return null;
  if (id === "12CnEaVZ9m2Fwr13DRj_AdNyDnek4lrA4") return LOOM_GUIDE_STREAM_PATH;
  return `https://drive.usercontent.google.com/download?id=${id}&export=download`;
}

export const VIDEO_FILTERS: { id: VideoFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "howto", label: "How-to guides" },
  { id: "mentorship", label: "Mentorship" },
];

export const VIDEO_RESOURCES: VideoResource[] = [
  {
    id: "howto-loom-submit",
    filter: "howto",
    platform: "loom",
    format: "video-guide",
    title: "How to submit your Loom video",
    description:
      "Step-by-step walkthrough of recording your Loom video and submitting the link correctly.",
    url: LOOM_VIDEO_GUIDELINES_URL,
    durationLabel: "1:39",
  },
  {
    id: "aaa-1",
    filter: "mentorship",
    platform: "ccbp",
    format: "event",
    title: "Ask An Achiever Session 1",
    description: "Live mentorship session with an IRP achiever.",
    url: "https://learning.ccbp.in/event-details/6cfdaaf2-16b7-4ad3-81bb-355128cba49e",
  },
  {
    id: "aaa-2",
    filter: "mentorship",
    platform: "ccbp",
    format: "event",
    title: "Ask An Achiever Session 2",
    description: "Live mentorship session with an IRP achiever.",
    url: "https://learning.ccbp.in/event-details/ef16181a-a952-4bd1-8751-2e2a1d2d6159",
  },
  {
    id: "aaa-3",
    filter: "mentorship",
    platform: "ccbp",
    format: "event",
    title: "Ask An Achiever Session 3",
    description: "Live mentorship session with an IRP achiever.",
    url: "https://learning.ccbp.in/event-details/8aa2a264-18a5-4f39-b183-a2a269a9bce7",
  },
];

export function resourcesForFilter(filter: VideoFilter): VideoResource[] {
  if (filter === "all") return VIDEO_RESOURCES;
  return VIDEO_RESOURCES.filter((item) => item.filter === filter);
}

export function showSection(filter: VideoFilter, section: Exclude<VideoFilter, "all">): boolean {
  return filter === "all" || filter === section;
}
