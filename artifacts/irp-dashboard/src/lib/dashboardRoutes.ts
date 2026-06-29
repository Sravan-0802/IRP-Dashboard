import type { PageKey } from "@/components/irp/Sidebar";

/** URL path for each dashboard tab. These show in the deployed link's address bar. */
export const PAGE_PATHS: Record<PageKey, string> = {
  dashboard: "/",
  assessments: "/assessments-hub",
  slot: "/assessment-calendar",
};

/** Resolve the active tab from the current (base-stripped) wouter location. */
export function pathToPage(path: string): PageKey {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === PAGE_PATHS.assessments) return "assessments";
  if (clean === PAGE_PATHS.slot) return "slot";
  return "dashboard";
}
