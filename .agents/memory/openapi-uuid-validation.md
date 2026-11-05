---
name: OpenAPI UUID validation compatibility
description: UUID schema generation with the current Orval and Zod combination.
---

Use an explicit UUID regex pattern in OpenAPI request schemas rather than `format: uuid` with the current generator/runtime combination.

**Why:** Orval emits top-level `zod.uuid()` for that format, but this project's Zod 3 runtime does not provide that API. Generated library type checks fail.

**How to apply:** Keep UUID validation in the source contract as a pattern and regenerate; do not patch generated files or upgrade the validation library merely for this format.
