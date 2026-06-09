---
name: IRP journey state semantics
description: How journeyState strings encode per-level assessment progress in the irp-dashboard
---

# IRP journey-state semantics

`journeyState` (see `artifacts/irp-dashboard/src/lib/journey.ts`) encodes both the level and the
sub-phase. When deriving per-level *assessment cleared* status, do NOT rely only on the
`getPhase()` abstraction.

Rule: a level's assessment is **cleared** when the raw state string contains `_POST_`. This covers
both `L*_POST_ASSESSMENT` and `L*_POST_REATTEMPT_WAITING` / `L*_POST_REATTEMPT_ACTIVE`.

**Why:** `getPhase()` maps `*_POST_REATTEMPT_WAITING`/`*_POST_REATTEMPT_ACTIVE` to the generic
`REATTEMPT_*` phase, which looks identical to the *pre-clear* reattempt states
(`L*_REATTEMPT_*`). Treating phase alone as the signal wrongly marks an already-cleared level as
still pending. The `_POST_` substring is the reliable discriminator.

**How to apply:** in score/status logic (e.g. `AssessmentScores.tsx`), use
`journey.journeyState.includes("_POST_")` for the current level; lower levels are cleared, higher
levels locked, `PLACED` = all cleared, and wildcard skips L1/L2.
