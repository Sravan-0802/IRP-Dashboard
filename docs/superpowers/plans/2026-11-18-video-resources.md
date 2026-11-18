# Video Resources Implementation Plan

> **For agentic workers:** Implement task-by-task. Static frontend only.

**Goal:** Add a Resource Hub **Video Resources** page matching the reference UI, wired to the provided social + Ask An Achiever + Loom links.

**Approach:** Static data module + page component (same pattern as Guideline Docs). No API/DB.

## Files

| File | Responsibility |
|---|---|
| `artifacts/irp-dashboard/src/lib/videoResources.ts` | Typed content list, filter keys, channel URLs, helpers |
| `artifacts/irp-dashboard/src/pages/VideoResources.tsx` | Page UI: filters, how-to featured card, YouTube/Instagram grids, mentorship events |
| `artifacts/irp-dashboard/src/components/irp/Sidebar.tsx` | Add `videos` PageKey + nav item |
| `artifacts/irp-dashboard/src/lib/dashboardRoutes.ts` | Path `/video-resources` |
| `artifacts/irp-dashboard/src/App.tsx` | Route |
| `artifacts/irp-dashboard/src/pages/Dashboard.tsx` | Render page |

## Tasks

- [x] Task 1: Data module with all 10 rows + Loom how-to
- [x] Task 2: VideoResources page UI
- [x] Task 3: Navigation wiring
- [x] Task 4: Smoke-check in browser
