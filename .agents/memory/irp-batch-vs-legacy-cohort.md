---
name: IRP batch vs. legacy cohort
description: Keep active registration batches authoritative over historical fixed-cycle cohort UI.
---

The admin panel's uploaded rosters govern current L1 registration. An active batch's invited users and recorded responses determine its registration state; separately uploaded, time-windowed access grants determine current exam links. Historical fixed July cohort or allowlist membership must not assert a current "already registered" state or imply a current exam seat.

**Why:** The user confirmed registration and already-registered data is uploaded through the admin panel, while a legacy fixed July UID list persisted in the dashboard and produced a false "already registered" banner. A student may also have expired past access grants without a current one.

**How to apply:** When investigating IRP L1 registration issues, verify the active uploaded batch membership and response, then the active uploaded access grants. Do not derive current status from fixed July lists or from a past registration. Confirm which admin upload defines any new status field before wiring it into the UI.

## Scheduled access visibility

Show upcoming assessment cards with disabled Start buttons before the saved opening time. Do not move assessment opening times just to make uploaded access visible.

**Why:** The user explicitly selected “Show upcoming cards with disabled Start buttons” after scheduled mock/main uploads were invisible in student preview.

**How to apply:** Uploaded roster membership can make the upcoming schedule visible; actual assessment access must still wait for the configured opening time.

## FE links on both student pages

Show the released FE assessment links in the Assessments Hub as well as on the Dashboard.

**Why:** The user requested that FE links visible on the Dashboard also appear in the Assessments Hub.

**How to apply:** Keep the same uploaded-roster, live-window, and qualification checks on both pages. Do not direct students back to the Dashboard as a substitute for showing an available FE link in the Hub.