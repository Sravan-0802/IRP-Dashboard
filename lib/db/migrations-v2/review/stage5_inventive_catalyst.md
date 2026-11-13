# Stage 5: Inventive Catalyst review of DESIGN.md

Reviewer: `egm-inventive-catalyst`. Status: completed. No Blockers; 3 Major and 2 Nit findings.

## 1. Per-tag criteria versus new assessments being judged automatically (Major)

**Where:** §5.5 rule 4, §7 alternative 2, §8 risk 4; `02_copy.sql` criteria seed.

**Problem:**
- Today's rules apply to every later assessment ("A1 onward 70%", "FE A7 onward 75%").
- The seed stops at Hustler A10, FE A9 and GenAI A4.
- So the first FE A10 or GenAI A5 sit would stay `RESULT_PENDING`, where today it is judged automatically.
- That breaks the §4 non-goal, "reproduce today's results".

**Fix options:**
- **A:** the daily sync creates a criteria row for any new tag, copied from the nearest lower-numbered tag of the same track and stage. The row is marked `created_by = 'auto-inherit'` and left unapproved.
- **B:** allow one explicit default row per track and stage, with "an exact tag beats the default".

## 2. Release-day rebuild and rollback lose data (Major)

**Where:** §8 risks 2 and 5, Step 5 item 7, Step 6, Rollback.

**Problem:**
- **Rollback after the switch:** the plan says dashboard-written rows "would need to be copied back by hand". That procedure is unwritten and unrehearsed.
- **Release day:** the sequence `09` → `01` → `02` deletes v2-only data. That includes admin edits to criteria and the ID lists moved out of code; `02` has no insert for `ALLOWLIST` or `MOCK_ALLOWLIST` groups.
- **Rollback after deletion:** restoring from CSV gives data that is at least a week stale.

**Fix:**
- Write and rehearse a reverse copy (`irp_v2` → `public`) for the dashboard-written tables.
- Make the v2-only loads (allowlists, criteria edits) explicit, re-runnable files.
- Before deleting the old tables, take a Neon branch or restore point and move them to an archive schema, instead of dropping them straight away.

## 3. The stored results have no single evaluator and no drift control (Major)

**Where:** §3 goal 1, §5.5 rules 3–5, Step 3 check 4, Step 5 items 2–3.

**Problem:**
- Parity is proven for the SQL in `02_copy.sql`, but after release the TypeScript `evaluateAttempt` decides every result, and nothing checks the two agree.
- The plan doesn't say what refills a student's track row after:
  - a project or Loom submission,
  - a Nexus interview sync,
  - an access override,
  - a criteria change.
- It names no action to re-judge pending sits once criteria are added, or to correct a pass mark entered in error.

**Fix:**
- Make `evaluateAttempt` and the refill function the only evaluator, with a check that they give the same results as the SQL.
- Call the refill function from every write path that affects a stage.
- Add a daily reconciliation that only reports mismatches.
- Add an audited "re-evaluate attempts for this tag" action.

## 4. The two attempt tables duplicate one definition (Nit)

**Problem:**
- `mern_track_attempts` and `genai_track_attempts` have identical columns, so DDL, copy logic and the evaluator are all written twice.
- The duplication already leaks: `genai_track_attempts` allows the stage `INTERVIEW`, but all human interviews are copied to the MERN table.

**Optional fix:** one physical table with a `track` column, exposed as two views. This reverses the product owner's decision, so it is optional.

## 5. Write-back failure handling is undefined (Nit)

**Problem:**
- The plan doesn't say that the watermark moves only after a successful merge.
- It doesn't say what happens when the 10:00 IST pull fails.
- It defines no change marker for `activity_logs`, which has no `updated_at`.
- It sets no alert on repeated failures.

**Fix:**
- Advance `last_synced_until` only after a merge commits.
- Start the push when the pull finishes, not at a fixed time.
- Alert when the last successful push is too old.

## Other notes from the reviewer

- `02_copy.sql` and `steps.mjs` refer to a `run.mjs`, but DESIGN.md lists only `steps.mjs` as the runner.
- `verify()` creates `irp_v2.parity_old_dashboard`, a 16th table in a schema the document says holds 15.
