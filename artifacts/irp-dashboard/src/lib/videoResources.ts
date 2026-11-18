/** Static Video Resources content for the Resource Hub. */

export type VideoFilter = "all" | "howto" | "mentorship" | "youtube" | "instagram";

export type VideoPlatform = "loom" | "youtube" | "instagram" | "ccbp";

export type VideoFormat = "video-guide" | "video" | "short" | "reel" | "post" | "event";

export type VideoResource = {
  id: string;
  filter: Exclude<VideoFilter, "all">;
  platform: VideoPlatform;
  format: VideoFormat;
  title: string;
  description?: string;
  url: string;
  /** YouTube video id when platform is youtube — used for thumbnails. */
  youtubeId?: string;
  durationLabel?: string;
};

export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@NxtWave";
export const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/nxtwave.tech/";

export const VIDEO_FILTERS: { id: VideoFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "howto", label: "How-to guides" },
  { id: "mentorship", label: "Mentorship" },
  { id: "youtube", label: "YouTube" },
  { id: "instagram", label: "Instagram reels" },
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
    url: "https://drive.google.com/file/d/12CnEaVZ9m2Fwr13DRj_AdNyDnek4lrA4/view",
    durationLabel: "1:30",
  },
  {
    id: "yt-1",
    filter: "youtube",
    platform: "youtube",
    format: "video",
    title: "IRP overview on YouTube",
    url: "https://youtu.be/E_X6gJHqB3c",
    youtubeId: "E_X6gJHqB3c",
  },
  {
    id: "yt-short-1",
    filter: "youtube",
    platform: "youtube",
    format: "short",
    title: "Internship Readiness Programme, NxtWave Academy",
    url: "https://youtube.com/shorts/i5VAeb_nTYY",
    youtubeId: "i5VAeb_nTYY",
  },
  {
    id: "ig-post-1",
    filter: "instagram",
    platform: "instagram",
    format: "post",
    title: "IRP social update",
    url: "https://www.instagram.com/p/DeYrq2uiLYx",
  },
  {
    id: "ig-reel-1",
    filter: "instagram",
    platform: "instagram",
    format: "reel",
    title: "IRP reel highlight",
    url: "https://www.instagram.com/reel/DejtquHPgoA/",
  },
  {
    id: "ig-reel-2",
    filter: "instagram",
    platform: "instagram",
    format: "reel",
    title: "Campus readiness tip",
    url: "https://www.instagram.com/reel/Dd6aSYHPFds/",
  },
  {
    id: "ig-reel-3",
    filter: "instagram",
    platform: "instagram",
    format: "reel",
    title: "Student journey snapshot",
    url: "https://www.instagram.com/reel/DdohEGtyu_i/",
  },
  {
    id: "ig-reel-4",
    filter: "instagram",
    platform: "instagram",
    format: "reel",
    title: "Ask An Achiever teaser",
    url: "https://www.instagram.com/reel/DeRdWDrhhzj/",
  },
  {
    id: "ig-reel-5",
    filter: "instagram",
    platform: "instagram",
    format: "reel",
    title: "Prep motivation reel",
    url: "https://www.instagram.com/reel/DdBzz5YvhgA/",
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

export function youtubeThumbnailUrl(youtubeId: string): string {
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

export function resourcesForFilter(filter: VideoFilter): VideoResource[] {
  if (filter === "all") return VIDEO_RESOURCES;
  return VIDEO_RESOURCES.filter((item) => item.filter === filter);
}

export function showSection(filter: VideoFilter, section: Exclude<VideoFilter, "all">): boolean {
  return filter === "all" || filter === section;
}
