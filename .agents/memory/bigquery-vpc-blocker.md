---
name: BigQuery access history
description: Historical VPC restrictions are not a permanent blocker; retain the user's Postgres-mirror design.
---

# BigQuery access can change

Previously, BigQuery calls from Replit were rejected with a VPC Service Controls 403. On 2026-10-07, development workflow logs showed a successful BigQuery basic-details fetch and completed sync. Do not assume the historical blocker still applies; production access has not been reverified.

The user chose scheduled syncing into Postgres, with the dashboard reading the mirror rather than issuing live BigQuery queries.

**Why:** VPC restrictions previously prevented direct access, and a stable mirrored source avoids making student requests depend on warehouse access.

**How to apply:** Use mirror data for normal dashboard reads. For new warehouse work, check current access and data freshness rather than repeating a categorical claim that BigQuery is blocked.
