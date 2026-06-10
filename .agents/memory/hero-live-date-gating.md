---
name: Hero "live" must be date-gated
description: Why assessment "live" UI in the IRP dashboard hero is gated on a date, not just journey state
---

The hero's "Assessment is live / Window closes in X days / Live now" UI is the
`EXAM_OPEN` phase. The journey phase alone is NOT date-aware, so it claimed the
assessment was live before the actual exam date.

Rule: any "live now / window closes" wording must be gated on `isAssessmentLive(now)`
(`lib/irpDates.ts`), true only for `EXAM_DATE <= now < RESULTS_UNLOCK_DATE`. Before
the date, render a non-live "approaching / goes live on {date}" state. Registrations
are CLOSED, so never show registration/"window closes" countdown framing pre-day.

**Why:** users saw "Assessment is live" days early. Live must only show on the
assessment date(s), and must stay correct for future cycles by editing dates only.

**How to apply:** when editing hero phases, gate any "live" copy on a date helper.
`REATTEMPT_ACTIVE` ("Round 2 is live") is the same class of issue but is driven by a
free-form `journey.reattemptDate` string — not yet gated; gate it if a structured
reattempt window becomes available.
