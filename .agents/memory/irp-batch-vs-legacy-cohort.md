---
name: IRP batch vs. legacy cohort
description: Keep active registration batches authoritative over historical fixed-cycle cohort UI.
---

An active registration batch is the current source for whether the student can register. Historical cohort or allowlist membership must not replace that state or imply a current exam seat. Check batch assignment, the student's response, and exam-platform access separately.

**Why:** Fixed prior-cycle membership can persist after its window closes, producing an “already registered” message while the student is not assigned to the active batch and has no current exam-access record.

**How to apply:** When investigating IRP L1 registration issues, verify active batch membership and response first; treat legacy cohort banners as cycle-specific history, and do not infer an exam-platform seat from self-service registration.