---
name: Dev seeding flow
description: How to find the active ACADEMY_USER_ID and seed the dev database so the dashboard loads locally.
---

# Rule
To get the IRP dashboard working locally from scratch:

1. **Find the real ACADEMY_USER_ID** — `curl localhost:80/api/auth/me` returns `{"userId":"<uuid>","userName":null}`. Do not guess from old logs; the secret value may differ.

2. **Seed two tables** for that UUID:
   - `academy_user_basic_details (user_id, user_name)` — display name
   - `academy_user_assessment_details (user_id, organisation_assessment_id, assessment_title, level)` — gate check; `userHasAssessmentData()` must return true or every `/api/student*` endpoint returns 404 (NOT_ENROLLED)

3. **No restart needed** after seeding — the API reads fresh from DB on each request.

**Why:** The `ACADEMY_USER_ID` env var is a Replit secret (value not inspectable). The `/api/auth/me` endpoint is the only reliable way to discover it without editing code.

**How to apply:** Whenever the dashboard shows "You're not in our data yet", run step 1 to verify the UUID, then step 2 to seed it.
