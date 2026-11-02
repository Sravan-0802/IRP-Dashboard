---
name: API server dev rebuild gotcha
description: Why newly added api-server routes 404 and new schema columns 500 in dev until you restart + push.
---

# api-server dev workflow only bundles at startup

The `artifacts/api-server` dev workflow runs `pnpm run build && pnpm run start` — esbuild bundles the source **once** at process start. It does NOT watch/rebuild on file changes.

**Symptoms when out of sync:**
- New route added in source but server returns **404** for it → running bundle predates the route. Fix: `restart_workflow "artifacts/api-server: API Server"`.
- Route reached but returns **500** referencing a missing column → schema has the column but the DB doesn't. Review the proposed development DB schema changes before applying them.

**How to apply:** After adding/changing routes, restart the API server workflow. For schema changes, inspect Drizzle's proposed DDL before applying it. This development database has legacy schema drift: `drizzle-kit push` has proposed creating existing tables and dropping existing sequences, and `--tablesFilter` did not limit the generated operations. Never use `--force` to bypass those conflicts. Apply only reviewed additive DDL to development, verify the table/columns, and keep the Drizzle source schema aligned. Production schema changes follow the project's publish flow; never run DDL against production.

**Why:** The API bundle is built only at workflow startup, while this shared database contains legacy relations that do not reconcile cleanly with the current Drizzle snapshot. A broad or forced push can risk unrelated schema/data.
