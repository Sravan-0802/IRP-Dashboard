# IRP Student Dashboard

Student dashboard for the NxtWave IRP program (React + Vite frontend, Express API, Postgres mirror of BigQuery data).

## Working rules (read before every task — these override your defaults)

### 1. Do exactly what was asked — nothing more
- Change only the files and lines needed for the request. No extra refactors, renames, cleanups, formatting passes, copy/text edits, UI restyling, dependency upgrades, or "while I'm here" improvements.
- If you notice another problem, **mention it in your reply** — do not fix it.
- Do not add features, fallbacks, tests, docs, or comments that were not requested.
- Do not revert, "restore", or rewrite code you did not write in this task, even if it disagrees with a note in `.agents/memory/`. If code and memory disagree, **ask**.
- Do not edit `.agents/memory/*` or this file unless the user asks.

### 2. Do not assume — ask
- If the request is ambiguous, or there are two reasonable ways to do it, **stop and ask one short question** before writing code.
- Never invent business rules (eligibility, access, dates, cut-offs, scores, statuses). Use only what the user stated or what is already in the code.
- Before editing, reply with a 1–3 line plan: which files you will change and what. Then do it.

### 3. Files you must not touch unless explicitly asked
- `.replit`, `.replitignore`, any `artifacts/*/.replit-artifact/artifact.toml`
- `package.json` dependencies, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig*.json`
- `scripts/post-merge.sh`, `lib/db/src/schema/*`, `lib/api-spec/*` (and generated clients)
- Secrets / env values — never hard-code keys or user IDs in code or config.

### 4. Database safety
- Never run `drizzle-kit push --force` / `push-force`. Never run DDL or data writes against production.
- Schema changes only when the user asks; show the proposed DDL first and wait for approval.
- Never bulk-update student statuses or data to "unlock" users.

### 5. Keep it fast — no extra verification loops
- Do **not** run the full `pnpm run build` or `pnpm run typecheck` — the repo has known pre-existing type errors unrelated to most tasks. Verify only what you changed:
  - API: `pnpm --filter @workspace/api-server run build`
  - Dashboard: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/irp-dashboard run build`
- No screenshots, browser tests, or e2e runs unless asked.
- Do not split work into parallel task-agent branches; work directly on `main`. (Branch merges have committed `<<<<<<<` conflict markers that broke publish.)
- Restart a workflow at most once per task. Do not publish more than once per request.

### 6. Before you say "done" / before publish
1. Run `git diff --stat` and confirm **only the files you planned** changed. If anything else changed, undo it.
2. Run `grep -rn "<<<<<<<" --include="*.ts*" artifacts/ lib/` — must return nothing.
3. Run the scoped build(s) above for the package(s) you changed.
4. Reply with: files changed, what you verified, what you did not verify. Do not publish unless the user says "publish".

## Current product decisions (user-confirmed — do not change without asking)
- **Dashboard access** = BigQuery `irp_eligible_status = ELIGIBLE` AND `lp_status = ACTIVE` AND `product_status = ACTIVE`. Checked live on app load via `GET /api/student/payment-status`.
- **Payment status is not an access rule.**
- **Assessment records are not an access rule.** A student with zero rows in `academy_user_assessment_details` still gets the dashboard (empty assessments). Do not re-add `userHasAssessmentData()` or the NOT_ENROLLED screen.

## Run & Operate
- API server (dev): `pnpm --filter @workspace/api-server run dev` — bundles once at start; restart after route changes.
- Dashboard (dev): `pnpm --filter @workspace/irp-dashboard run dev`
- API codegen: `pnpm --filter @workspace/api-spec run codegen`
- Required env: `DATABASE_URL`, BigQuery service-account vars (`project_id`, `client_email`, `private_key`, …), `BQ_DATASET`.

## Where things live
- Access decision: `artifacts/api-server/src/lib/academyUserProfile.ts`, route in `artifacts/api-server/src/routes/student.ts` (`/student/payment-status`)
- Frontend gate: `artifacts/irp-dashboard/src/App.tsx` (`Home`)
- Admin endpoints (API-key auth): `artifacts/api-server/src/routes/admin.ts`
- DB schema: `lib/db/src/schema/`
- Project notes: `.agents/memory/` (background only — the rules above win)
