---
name: Publish schema diff is dev→prod
description: Why a table defined in schema code can still be missing in production after multiple publishes.
---

Replit's publish flow migrates the production schema by diffing the **development** database against production and applying the difference. It does NOT read the Drizzle schema source directly.

**Why:** A table/column can exist in `lib/db/src/schema` (and be referenced by routes) yet never reach production if it was never pushed to the **dev** database. Publishing repeatedly does nothing because the dev→prod diff is empty — dev is missing it too. Production then fails at runtime with `relation "X" does not exist` (500).

**How to apply:** When prod reports a missing table/column:
1. Check the table exists in BOTH dev and prod via `to_regclass('public.<table>')`.
2. If dev is also missing it, run the dev push (`pnpm --filter @workspace/db run push`) so the dev DB matches the schema source.
3. Restart the API server workflow (routes bundle only at startup) and verify the feature in dev.
4. Tell the user to re-publish — that is the only supported path to mutate the prod schema. Never run DDL against prod or add deploy/startup-time migrations.
