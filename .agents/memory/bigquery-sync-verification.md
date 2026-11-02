---
name: BigQuery sync verification
description: Safety and completion checks when a production mirror refresh is partially complete or reports busy.
---

Do not report a full mirror refresh as complete when only individual tables have succeeded. Do not clear an in-progress sync solely because BigQuery lists no running jobs.

**Why:** A production refresh completed basic details while other tables remained older and the application still reported an active sync. Warehouse query completion and database result loading are separate phases.

**How to apply:** Verify the requested tables' completion timestamps and errors. When a busy run appears stalled, distinguish row-write progress from completed-table status and establish worker ownership before forcing recovery. If that cannot be established, report the refresh as blocked rather than starting an overlapping run.
