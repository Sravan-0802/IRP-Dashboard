import type { PageKey } from "@/components/irp/Sidebar";

/** URL path for each dashboard tab. These show in the deployed link's address bar. */
export const PAGE_PATHS: Record<PageKey, string> = {
  dashboard: "/",
  genai: "/genai-program",
  slot: "/assessment-calendar",
  guidelines: "/guideline-docs",
  noc: "/noc-form",
  home: "/home",
};

/** Old links still resolve: About is now Home, and the Assessments Center lives on the calendar page. */
const LEGACY_HOME_PATH = "/about";
const LEGACY_ASSESSMENTS_HUB_PATH = "/assessments-hub";

/** Resolve the active tab from the current (base-stripped) wouter location. */
export function pathToPage(path: string): PageKey {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === PAGE_PATHS.genai) return "genai";
  if (clean === PAGE_PATHS.slot || clean === LEGACY_ASSESSMENTS_HUB_PATH) return "slot";
  if (clean === PAGE_PATHS.guidelines) return "guidelines";
  if (clean === PAGE_PATHS.noc) return "noc";
  if (clean === PAGE_PATHS.home || clean === LEGACY_HOME_PATH) return "home";
  return "dashboard";
}
