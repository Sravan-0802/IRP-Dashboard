---
name: API server dev rebuild gotcha
description: Why newly added api-server routes 404 and new schema columns 500 in dev until you restart + push.
---

# api-server dev workflow only bundles at startup

The `artifacts/api-server` dev workflow runs `pnpm run build && pnpm run start` — esbuild bundles the source **once** at process start. It does NOT watch/rebuild on file changes.

**Symptoms when out of sync:**
- New route added in source but server returns **404** for it → running bundle predates the route. Fix: `restart_workflow "artifacts/api-server: API Server"`.
- Route reached but returns **500** referencing a missing column → schema has the column but the DB doesn't. Fix: `pnpm --filter @workspace/db run push`.

**How to apply:** After adding/changing api-server routes OR `lib/db` schema, always (1) restart the api-server workflow and (2) run db push. Production is separate: a deploy rebuilds the bundle, but the **production DB** still needs the schema applied (see the `database` skill, environment=production).
