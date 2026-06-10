---
name: L1-only journey gate
description: Temporary clamp that forces every student's journey to Level 1 until L2/L3 launch.
---

The student dashboard currently shows ONLY Level 1, by product decision ("only L1 as of now").

Two enforcement points:
- Server: `clampToL1()` in `artifacts/api-server/src/routes/journey.ts` `serialize()` coerces any `L2_*`/`L3_*` stored state to its `L1_` phase equivalent, and `WILDCARD_ACTIVE`/`PLACED`/unknown to `L1_PREP`; also forces `isWildcard=false` on read. It is READ-ONLY — it does not mutate the DB, so stale L2/L3/wildcard rows still exist underneath.
- Frontend: `getLevel()` in `irp-dashboard/src/lib/journey.ts` defaults unrecognized states to `1` (previously defaulted to `3`, which caused fresh/stale students to render "Level 3 / Infinite Aura").

**Why:** Production DB had student #1 stuck at an L3 state (leftover from the removed preview-state selector). Dev was L1_PREP but published app showed L3. A read-side clamp fixes display on republish without prod DB write access.

**How to apply (when enabling L2/L3):**
1. Remove `clampToL1()` and revert `serialize()` to pass through `journeyState`/`isWildcard`.
2. Run a one-time normalization on prod for stale wildcard/L3 rows.
3. Reconsider blocking non-L1 writes (admin state-set, wildcard onboarding) — those still persist non-L1 states even while the gate hides them.
