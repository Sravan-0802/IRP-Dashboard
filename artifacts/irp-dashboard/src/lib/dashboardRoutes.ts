import type { PageKey } from "@/components/irp/Sidebar";
import { SHOW_FAQS, SHOW_WHAT_TO_STUDY } from "@/lib/featureFlags";

/** URL path for each dashboard tab. These show in the deployed link's address bar. */
export const PAGE_PATHS: Record<PageKey, string> = {
  dashboard: "/",
  genai: "/genai-program",
  assessments: "/assessments-hub",
  slot: "/assessment-calendar",
  videos: "/video-resources",
  guidelines: "/guideline-docs",
  study: "/what-to-study",
  faqs: "/faqs",
  noc: "/noc-form",
  home: "/home",
};

/** Old links still resolve: About is now Home. */
const LEGACY_HOME_PATH = "/about";

/** Resolve the active tab from the current (base-stripped) wouter location. */
export function pathToPage(path: string): PageKey {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === PAGE_PATHS.genai) return "genai";
  if (clean === PAGE_PATHS.assessments) return "assessments";
  if (clean === PAGE_PATHS.slot) return "slot";
  if (clean === PAGE_PATHS.videos) return "videos";
  if (clean === PAGE_PATHS.guidelines) return "guidelines";
  // Hidden tabs fall back to the dashboard, so a direct link shows nothing new.
  if (clean === PAGE_PATHS.study) return SHOW_WHAT_TO_STUDY ? "study" : "dashboard";
  if (clean === PAGE_PATHS.faqs) return SHOW_FAQS ? "faqs" : "dashboard";
  if (clean === PAGE_PATHS.noc) return "noc";
  if (clean === PAGE_PATHS.home || clean === LEGACY_HOME_PATH) return "home";
  return "dashboard";
}
