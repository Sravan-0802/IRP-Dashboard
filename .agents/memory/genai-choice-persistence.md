---
name: GenAI choice persistence scope
description: Why project choices use browser-local preferences rather than the Loom submission record.
---

Treat unsent project choices as per-account browser preferences, separate from successfully submitted Loom videos.

**Why:** Returning to the chooser required persistence across navigation and reloads, not cross-device synchronization. Existing lightweight preferences already use browser storage; saving choices must not create or change a submitted Loom record.

**How to apply:** Keep the browser-only scope explicit to students. If cross-device synchronization is requested, add authenticated preference persistence rather than repurposing a successful submission as draft state.
