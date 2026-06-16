---
name: Drizzle pkey retry detection
description: Drizzle wraps PG errors so the top-level message never contains the constraint name; must check the cause chain too.
---

# Rule
When catching Drizzle errors to detect a specific PG constraint (e.g. `students_pkey`), check both `err.message` AND `err.cause.message` — Drizzle's `_DrizzleQueryError` wraps the underlying PG error so the top-level `message` is "Failed query: INSERT INTO…", not the constraint violation text.

**Why:** `student.ts::getOrCreateStudentForUser` had a retry path for stale serial sequences keyed on `message.includes("students_pkey")`. The check silently failed because the constraint name only appears in the `cause` chain, causing the 500 to propagate instead of retrying.

**How to apply:** Concatenate `err.message` + (err.cause as Error)?.message before doing `.includes()` checks on PG constraint names. Already fixed in `lib/student.ts`.
