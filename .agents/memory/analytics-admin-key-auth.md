---
name: Analytics admin-key auth (local testing)
description: Why the admin-protected analytics route can't be curl-tested with "dev" locally, and how to test it.
---

The admin routes (`/api/analytics/*`, sync) are guarded by `checkApiKey`. Its `dev` fallback (`provided === "dev"`) only applies when **neither** `ANALYTICS_ADMIN_KEY` **nor** `TOKEN_SECRET` is set.

**Gotcha:** `TOKEN_SECRET` IS set in this project, so `curl -H "x-api-key: dev"` returns 401. The valid local key is the `TOKEN_SECRET` (or `ANALYTICS_ADMIN_KEY` if configured) value.

**Why:** wasted several attempts trying `dev` and trying to read the secret via `viewEnvVars` — secret values are redacted (returned as empty objects `{}`), so you cannot retrieve them programmatically to authenticate.

**How to apply:** To verify admin-protected endpoint logic locally, don't fight the auth — validate the data/aggregation with a direct SQL query (`executeSql`) instead, and rely on typecheck + a page screenshot for the UI. The real key only matters in the user's browser/prod.
