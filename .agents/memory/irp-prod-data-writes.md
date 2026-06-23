---
name: IRP production data writes
description: How to mutate IRP production student data (e.g. mark candidates FE-Project-Done) given prod is read-only from the agent.
---

# Writing to the IRP production database

Dev and prod are **separate** Postgres databases. The agent's `executeSql` against
`environment: "production"` is **read-only** (SELECT only). Dev only contains demo
students; real candidates (keyed by `${academy_user_id}@academy.local` in the
`students` table) live in prod.

**Rule:** to mutate prod student data (journey state, project_submitted, etc.), the
write must go through the **deployed app**. The pattern is:
1. Add/confirm an admin-key-gated write endpoint in `@workspace/api-server`
   (auth via `checkApiKey` — accepts `ANALYTICS_ADMIN_KEY` or `TOKEN_SECRET`).
2. **Publish** so the endpoint reaches production (a code change is not live in prod
   until published).
3. Call the endpoint against the production domain (`$REPLIT_DOMAINS`) with the admin
   key in `x-api-key`.

**Why:** there is no direct prod DB write path from the agent; the live app is the
only writer. `POST /student/journey/state` only mutates the *authenticated* user, so
it cannot be used for admin batch updates of other users.

**FE Project Done** for a candidate = `students` row with `project_submitted=1` and
`journey_state='L1_POST_ASSESSMENT'` (read path clamps L2/L3 → L1, so always use the
L1 variant). The FE Project journey step renders "done" purely from `projectSubmitted`.
Endpoint `POST /api/admin/students/fe-project-done` upserts a batch of academy_user_ids
(only those present in `academy_user_assessment_details`).
