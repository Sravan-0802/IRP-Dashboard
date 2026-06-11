---
name: L1-only journey gate
description: Temporary clamp that forces every student's journey to Level 1 until L2/L3 launch.
---

The student dashboard currently shows ONLY Level 1, by product decision ("only L1 as of now").

Exception: academy user IDs in `L3_ALLOWED_ACADEMY_USER_IDS` (a Set in `journey.ts`) bypass the clamp and see their true level. `shouldClampToL1(req)` resolves the SSO user via `resolveAcademyUserId(req)` and returns false only for allowlisted IDs; default (no/invalid token, or not listed) is clamped. Add IDs to that Set as requested.

Two enforcement points:
- Server: `clampToL1()` in `artifacts/api-server/src/routes/journey.ts` is applied in `serialize(s, clamp)` (clamp decided per-request by `shouldClampToL1`). It coerces any `L2_*`/`L3_*` stored state to its `L1_` phase equivalent, and `WILDCARD_ACTIVE`/`PLACED`/unknown to `L1_PREP`; also forces `isWildcard=false`. READ-ONLY — does not mutate the DB, so stale L2/L3/wildcard rows still exist underneath. NOTE: journey route is still singleton (`STUDENT_ID=1`); allowlist gates visibility of student #1's state, not true per-user data.
- Frontend: `getLevel()` in `irp-dashboard/src/lib/journey.ts` defaults unrecognized states to `1` (previously defaulted to `3`, which caused fresh/stale students to render "Level 3 / Infinite Aura").

**Why:** Production DB had student #1 stuck at an L3 state (leftover from the removed preview-state selector). Dev was L1_PREP but published app showed L3. A read-side clamp fixes display on republish without prod DB write access.

**How to apply (when enabling L2/L3):**
1. Remove `clampToL1()` and revert `serialize()` to pass through `journeyState`/`isWildcard`.
2. Run a one-time normalization on prod for stale wildcard/L3 rows.
3. Reconsider blocking non-L1 writes (admin state-set, wildcard onboarding) — those still persist non-L1 states even while the gate hides them.
