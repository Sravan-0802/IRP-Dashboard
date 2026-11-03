---
name: BigQuery access history
description: Historical VPC restrictions are not a permanent blocker; retain the user's Postgres-mirror design.
---

# BigQuery access can change

Previously, BigQuery calls from Replit were rejected with a VPC Service Controls 403. On 2026-10-07, development workflow logs showed a successful BigQuery basic-details fetch and completed sync. Do not assume the historical blocker still applies; production access has not been reverified.

Normal dashboard data uses scheduled syncing into Postgres. The user subsequently requested a live BigQuery access-status check on each app load.

**Why:** VPC restrictions previously prevented direct access, and a stable mirrored source avoids making student requests depend on warehouse access.

**How to apply:** Keep normal profile/results reads on the mirror, but verify admission statuses live for the authenticated student on app load. Do not substitute stale mirror access on query failure. Check current warehouse access rather than assuming the historical blocker persists.
