# Stage 5: Zoom-out review of DESIGN.md

Reviewer: `egm-zoom-out`. Status: completed. **Verdict: not ready to approve.** 2 Blockers, 8 Major, 6 Nit.

## Blockers

### B1. No deployment path that fits this project
- `replit.md` rule 4 forbids DDL against production.
- `.agents/memory/publish-schema-diff-dev-to-prod.md` says Replit publish diffs the dev database against prod, and that publishing is "the only supported path to mutate the prod schema".
- The design runs hand-written DDL into a second Postgres schema, `irp_v2`, through a custom runner.
- `drizzle.config.ts` manages `public` only.
- The design doesn't say:
  - what publish does with an `irp_v2` schema that exists in prod but not in dev,
  - whether dev gets the same migration,
  - whether the tables stay in `irp_v2` for good.

**Fix:** define the tables in Drizzle and ship them through the normal push-and-publish flow, with only the data copy as a one-off script. Otherwise, record an approved exception and decide the permanent schema name.

### B2. The cutover is one irreversible big-bang release
- One release would change all of the following, with the API stopped:
  - the daily sync,
  - every API route,
  - the browser's result logic,
  - the login token format,
  - the hardcoded ID lists,
  - the BigQuery writers.
- Rolling back admits data loss.

**Fix:** ship it in separate stages, each of which can be undone:
1. Drop the 12 dead tables.
2. Add the criteria, attempts and track tables, and have the sync write them alongside the old ones.
3. Compare results on live data for some days.
4. Switch reads one route at a time.
5. Retire the old result tables.

## Major

- **M1. About half the scope fixes no stated problem.** Login tokens, support chat, feedback, analytics, registrations and settings aren't broken, yet rewriting them forces every route to change. "44 to 15" is a count target, and dropping the dead tables alone reaches 32. Token hashing is a separate security change, and the new table drops the `used` column.
- **M2. The supporting tables become generic catch-alls** (`student_groups`, `activity_logs`, `admin_settings`). That is the trade-off the design rejects for attempts as "harder for the program team to query".
- **M3. Pass marks still exist in two places.** BigQuery's SQL keeps computing "qualified" with its own hardcoded marks. `mern_track` writes columns with the same names back to BigQuery, so two producers can disagree. The design needs to say which system is authoritative, or rename the dashboard's columns.
- **M4. The two attempt tables duplicate one definition.** Alternatives not considered:
  - one attempts table plus a view per track,
  - a SQL view for the track rows, which would need no refill code.
- **M5. Files are listed that don't exist yet:** the parity query, the verify script, and the runner (`run.mjs`).
- **M6. The parity check covers only 4 statuses.** It leaves out:
  - GenAI project, video and interview,
  - Level 2,
  - dashboard access override and blocked,
  - group membership.
- **M7. There is no complete old→new mapping for all 44 tables.** Folding `blocked_users` into `access_override` overwrites a grant on the same student, and that behaviour isn't documented.
- **M8. The BigQuery write-back is over-built.** A full daily replace of the track tables is simpler. The design should name the writers it retires, and drop the `activity_logs` export until someone asks for it.

## Nit

- **N1.** Speculative columns:
  - `approved_by`, `created_by`, `source_system = 'MANUAL'`;
  - the `genai_human_interview_*` columns, which are never filled.
- **N2.** Dead data (legacy access flags, `unpaid_users`) is carried into `student_groups` instead of staying in the CSV backup only.
- **N3.** Sections 5.4 and 5.5 leave out some rules the SQL applies: Human Interview becomes active from `journey_state`; Level 2 comes from `journey_state`; GenAI project and video count as qualified on submission. The interview attempt count uses `count(*)`, not distinct tags.
- **N4.** Two rehearsal environments (local embedded Postgres and the Neon branch) where the branch alone would do.
- **N5.** The "50 random students" check is redundant if the parity check covers every student.
- **N6.** The pass/fail rule is implemented twice, in SQL and in TypeScript, and they could diverge.

## Outside the document
`lib/db/migrate-db.mjs` hardcodes Neon passwords as fallback values. Don't model the runner on it, and change those passwords.
