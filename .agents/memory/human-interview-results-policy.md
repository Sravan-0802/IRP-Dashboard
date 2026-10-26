---
name: Human interview results policy
description: Source authority, multiple-attempt semantics, and release rules for IRP human interviews.
---

Show every IRP human-interview attempt, with its final score and source clearanceStatus. The latest completed scored attempt governs the overall clearance, not the highest score or any earlier pass. Later scheduled, cancelled, no-show, partial, or unknown-status interviews must not replace a completed result.

**Why:** The user requested multiple interview scores, consideration of the latest score, clearance status, and an admin fetch button.

**How to apply:** Use interview date/start time to order attempts; trust the source's Cleared/Not Cleared status rather than inventing another qualification threshold. Preserve the existing admin release setting during manual fetches.

The uploaded Academy Nexus API document omits interviewId, but the live API supplies it.

**Why:** A student may have multiple interviews; Academy UID alone cannot identify an attempt.

**How to apply:** Retain attempts by the source interview ID rather than collapsing them by student or score.
