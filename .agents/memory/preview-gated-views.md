---
name: Previewing gated student views
description: How to visually verify a per-user gate (paywall, exam link, etc.) when the dev preview identity is a protected secret.
---

The dev preview identity is `ACADEMY_USER_ID`, stored as a **secret** — it cannot
be changed via `setEnvVars` (conflict error) and its value is not viewable.
`resolveAcademyUserId` uses it as the current user in non-prod.

To visually verify a view that is gated on membership in some table (e.g.
`unpaid_users` paywall, `l1_exam_access` exam link):

1. `curl localhost:80/api/auth/me` to learn the current preview user's id.
2. Temporarily INSERT that id into the gating table (dev DB) via `executeSql`.
3. Screenshot the app.
4. DELETE the row to revert.

**Why:** you cannot switch the preview account, so instead move the *data* under
the fixed account, then restore it.
**How to apply:** any time you need a screenshot of a state that depends on the
user being in/out of a specific table.
