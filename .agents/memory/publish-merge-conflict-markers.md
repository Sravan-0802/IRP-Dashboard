---
name: Publish fails on merge conflict markers
description: Recurring publish build failures caused by unresolved git conflict markers in irp-dashboard
---
Publish builds have failed twice because unresolved git merge conflict markers (`<<<<<<<`) were committed to `main` — both times in the dashboard's Analytics page, introduced by merges of task-agent branches.

**Why:** the platform's task-merge/publish flow can commit conflict markers silently; the failure only surfaces as an esbuild "Unexpected <<" error in the deploy build log.

**How to apply:** when a publish build fails, first run `grep -rn "<<<<<<<" --include="*.ts*" artifacts/`. After any branch merge, do the same check before suggesting publish. Local build check needs env vars: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/irp-dashboard run build`.
