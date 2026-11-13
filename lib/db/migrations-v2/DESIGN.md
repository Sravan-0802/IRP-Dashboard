# IRP dashboard data model v2

Status: draft for review. Nothing described here has been run against the production database.

## 1. Background

The IRP (Internship Readiness Program) dashboard shows each student where they stand in the program. It is a React frontend and an Express API. The API reads a Postgres database hosted on Neon.

Most student results are produced outside the dashboard:

- **BigQuery** is the company data warehouse. It holds each student's profile, course progress, and every assessment sitting. The API copies this data into Postgres once a day at 10:00 IST.
- **Academy Nexus** is a separate internal service that holds human interview results. An admin triggers that copy by hand.

The dashboard itself creates a smaller amount of data: login tokens, assessment registrations, project submissions, support chat, feedback, click events, and admin settings.

Terms used in this document:

| Term | Meaning |
|---|---|
| Track | A program path. There are two: **MERN** and **GenAI**. |
| Stage | One step of a track. MERN: Online Assessment (also called Hustler), FE Project, Human Interview, Level 2 access. GenAI: Assessment, Project Submission, Loom Video, Human Interview. |
| Sit / attempt | One sitting of one assessment or interview by one student. |
| Tag | BigQuery's identifier for one assessment, in the column `assessment_specific_tag`, for example `ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A4`. The trailing `A4` is the assessment number. |
| MAIN / MOCK | A MAIN sit counts toward clearing a stage. A MOCK sit is practice and never counts. |
| Criteria | The pass mark for one tag. |
| Old tables | The 44 tables in Postgres schema `public` today. |
| New tables | The 15 tables this document proposes, in Postgres schema `irp_v2`. |

## 2. Problem

The database has 44 tables. An audit of the code and the data found:

1. **12 tables are dead.** 8 are leftovers from a project template and no screen reads them. 3 are written on every sync and never read. 1 gates nothing since the access rule changed.
2. **The stage result is not stored anywhere.** The browser works out "Qualified", "Cleared" and "In progress" on every page load from four API responses. Because it exists only in the browser, it cannot be reported or sent to BigQuery.
3. **"Qualified" is calculated in about seven places** that can disagree: two columns on the assessment table, three status tables, SQL that runs inside BigQuery with its own hardcoded pass marks, the API at request time, and the browser.
4. **Pass marks live in three places**: defaults in API code, a copy in BigQuery SQL, and an admin panel whose saved values only partly take effect. The admin panel stores no record of who changed a pass mark or what it was before.
5. **Rows that are not assessments sit in the assessment table.** 10,635 rows there are access flags (`manual-access-grant`, `manual-access-revoke`, `dashboard-access-override`).
6. **About 10,000 student IDs are hardcoded in source files** as allowlists for specific exam dates.
7. **Three writers compete for the same BigQuery output tables**, and each overwrites the others.

## 3. Goals

1. Store each student's result for each stage in one row per track, so the dashboard reads it instead of calculating it.
2. Keep every sit as its own row, with the pass mark it was judged against.
3. Define the pass mark for each tag in exactly one place, with history.
4. Use BigQuery's column names wherever the data comes from BigQuery, so no mapping sheet is needed.
5. Reduce 44 tables to 15 without losing any data that a screen, an admin or a report uses.
6. Send the per-student stage results back to BigQuery through one path.

## 4. Non-goals

- Changing any pass mark or any access rule. The migration must reproduce today's results.
- Changing what students see on screen.
- Building per-person admin logins. The design leaves room for them (`created_by` columns) but does not build them.
- Changing what BigQuery or Academy Nexus produce.

## 5. Proposed model

### 5.1 Core tables

| Table | One row is | Purpose |
|---|---|---|
| `users` | one student | Profile from BigQuery plus dashboard access override and onboarding flag. |
| `mern_track` | one student | The student's current result for each MERN stage, their journey state, and course progress. |
| `genai_track` | one student | The same for GenAI stages, plus the project and Loom submission. |
| `mern_track_attempts` | one sit | Every MERN assessment, FE project, AI mock and human interview sitting. |
| `genai_track_attempts` | one sit | Every GenAI assessment and AI mock sitting. Same columns as the MERN table. |
| `assessment_criteria` | one pass mark for one tag | The only place a pass mark is defined. |

Every student gets one row in `mern_track` and one row in `genai_track`, including students who have not started that track.

The exact columns are in [01_create.sql](01_create.sql).

### 5.2 Supporting tables

| Table | Replaces | Purpose |
|---|---|---|
| `login_tokens` | `forms_auth_tokens` | One row per login session. Stores a SHA-256 hash of the token, not the token. |
| `admin_settings` | `visibility_settings`, `genai_training_popup`, `program_board` | One row per setting, value stored as JSON. |
| `student_groups`, `student_group_members` | `access_batches`, `access_batch_users`, `registration_batches`, `registration_batch_users`, `l1_exam_access`, `unpaid_users` | Any named list of students: who gets an exam link, who may register for a date. |
| `assessment_registrations` | `l1_cycle_registrations` | A student's sign-up for one assessment date. |
| `support_conversations`, `support_messages` | the two tables of the same name, plus `contact_us_messages` | Support chat. Old contact-form messages become one-message conversations. |
| `activity_logs` | `dashboard_analytics_events`, `dashboard_feedback`, `auth_code_logs` | One row per click, feedback form or login attempt. |
| `sync_logs` | `bigquery_sync_status` | One row per data sync run, in either direction. |

### 5.3 Naming

Columns that hold BigQuery data keep the BigQuery column name: `assessment_specific_tag`, `user_assessment_score_percentage`, `hustler_assessment_status`, `fe_project_score_percentage`, `irp_eligible_status`. The one result the dashboard calculates is named `qualification_status`, which is the name BigQuery's existing output table already uses.

`mern_track` follows the column names of BigQuery's per-student summary table `z_academy_irp_2_0_l1_user_round_wise_summary`. BigQuery has no such table for GenAI, so `genai_track` uses the same pattern with a `genai_` prefix.

### 5.4 Status values

A stage status in a track table is one of:

| Value | Meaning |
|---|---|
| `NOT_ATTEMPTED` | The student has not reached this stage. The screen shows a lock. |
| `ACTIVE` | The stage is open to the student and nothing is written yet. |
| `RESULT_PENDING` | The student sat it; there is no result yet. |
| `QUALIFIED` | Cleared. |
| `NOT_QUALIFIED` | Sat it and did not clear. |

An attempt's `qualification_status` is one of `QUALIFIED`, `NOT_QUALIFIED`, `NOT_ATTEMPTED`, `RESULT_PENDING`.

### 5.5 How a result is decided

1. Each sit is stored as one attempt row, with the score and the status exactly as the source sent it (`assessment_status`).
2. The attempt's tag is looked up in `assessment_criteria`. There are three kinds of criteria:
   - `PERCENTAGE`: the sit qualifies when `user_assessment_score_percentage` is at least `qualifying_score_percentage`. Used for MERN Online Assessment (70) and FE Project (A1 70, A2 100, A3 to A6 90, A7 to A9 75).
   - `SECTION_MARKS`: the sit qualifies when the MCQ marks and the coding marks each reach their own minimum. Used for GenAI assessments (A1 and A2: 20 and 48; A3 and A4: 25 and 48).
   - `EXTERNAL_RESULT`: the source's own verdict is used. Used for human interviews (Academy Nexus decides) and for five old tags from before per-assessment numbering.
3. The result and the pass mark used are written onto the attempt row (`qualification_status`, `criteria_id`, `qualifying_score_percentage`). A later change to the criteria does not rewrite what an old sit was judged against.
4. A tag with no criteria row is not guessed. A started sit stays `RESULT_PENDING` until an admin adds criteria for the tag.
5. The track row is filled from the attempts. A stage is `QUALIFIED` if any MAIN sit of that stage qualified. Otherwise it takes the status of the latest written MAIN sit. The human interview stage takes the status of the latest interview. A stage becomes `ACTIVE` when the stage before it is `QUALIFIED`.

These values are today's effective rules. The migration copies them; it does not change them.

To change a pass mark, an admin adds a new `assessment_criteria` row and the old row gets an end date in `valid_until`. Only one row per tag can be current; a unique index enforces this.

### 5.6 What goes back to BigQuery

`mern_track`, `genai_track`, `assessment_registrations` and `activity_logs`. One job sends only the rows changed since its last run, into a staging table and then a merge into the target, once a day after the 10:00 IST copy from BigQuery. This replaces the three competing writers.

## 6. Data that needs special handling

Checked against the production data:

| Finding | Rows | Handling |
|---|---|---|
| Access flags stored as assessment rows | 10,635 | `dashboard-access-override` (2 rows) becomes `users.access_override = 'GRANTED'`. The other two kinds grant nothing today; they are kept as inactive groups for history. |
| Sits stored with a short tag such as `A4` by an older sync | 5,628 | The full tag is rebuilt as kind plus number. A query on BigQuery confirmed that every such sit's real tag has this form. The original value is kept in `section_details`. |
| Students shown as qualified only through BigQuery's summary table, with no row per sit | 371 | One attempt row is created from the summary, marked `source_system = 'BIGQUERY_SUMMARY'`. |
| The same sit recorded twice under two different IDs | up to 1,539 | Both rows are kept. Attempt counts on the track row count distinct tags, so a sit is counted once. |
| Free-text dates with typos, for example `November 1st`, `^th September 2026` | all registrations | The original text is kept in `assessment_date_label`. A parsed date is stored beside it and left empty when the text cannot be read. |
| User IDs that appear in result tables but not in the BigQuery profile table | 7 | A placeholder `users` row is created, marked `record_source = 'NOT_IN_BIGQUERY'`. |
| Login tokens | 109,266 | Only tokens that have not expired are copied (18 at the time of checking). |
| Human interview outcomes other than cleared or not cleared (`no_show`, `cancelled`, `declined`, `partially_completed`) | 50 | The first three become `NOT_ATTEMPTED`; `partially_completed` becomes `RESULT_PENDING`. The original value stays in `assessment_status`. |

Not copied: the 8 template tables (31 rows of demo data) and the 4 tables that only hold calculated results. They are exported to CSV before anything is deleted.

## 7. Alternatives considered

1. **One generic `attempts` table and one `stage_status` table for both tracks.** Fewer tables, and a third track would need no new table. Rejected at the product owner's request: two tables per track are easier for the program team to query, and the columns can use BigQuery's names for each track.
2. **Keep pass marks as number ranges ("A3 to A6 need 90").** This is today's design. It let two saved ranges overlap at A3, where the outcome depended on match order. One row per tag removes the ambiguity. The cost is that an admin must add a row for each new assessment before its results appear.
3. **Rename and alter the old tables in place.** Rejected because the live dashboard reads those tables. Building the new tables beside the old ones lets the two be compared before any screen depends on the new ones.
4. **Keep calculating the stage result in the browser.** Rejected because it is the reason the result cannot be reported or written back to BigQuery.

## 8. Risks

1. **Results that differ after the move.** A student could see a different stage result. Mitigation: a separate query, written from the application code without reference to the migration, reproduces what each student sees today. The migration is accepted only when the new tables match it for every student, or every difference is explained and approved.
2. **Data changes during the move.** The old tables keep receiving writes (the daily sync, registrations, submissions, support messages). A copy made days before the code switch would be stale. Mitigation: the copy is cheap to repeat. It is rerun in full immediately before the code switch, during a short window in which the API is stopped.
3. **Callers outside the dashboard.** Some API routes are called by other systems with an API key (the login provider, scripts). Mitigation: route paths and response shapes do not change; only the tables behind them do.
4. **A new assessment without criteria.** Its results would show as pending. Mitigation: the admin panel lists tags that have sits and no criteria.
5. **Deleting the old tables is not reversible.** Mitigation: a CSV export of all 44 tables is taken first, and deletion waits until the new tables have served the dashboard for a week.

## Detailed Implementation Plan

Files in this folder:

| File | Purpose |
|---|---|
| [01_create.sql](01_create.sql) | Creates schema `irp_v2`, three helper functions, and the 15 tables. |
| [02_copy.sql](02_copy.sql) | Copies and converts all data from `public` into `irp_v2`. Reads the old tables only. |
| `parity_old_dashboard.sql` | One query returning what each student sees today, derived from the application code. |
| `03_verify.sql` | One query returning one row per check with `PASS` or `FAIL`. |
| `09_rollback.sql` | Drops schema `irp_v2`. The old tables are never changed by any of these files. |
| [steps.mjs](steps.mjs) | Runs the files in order. `01` and `02` run in one transaction, so a failure leaves nothing behind. |

### Step 1. Rehearse on a local copy

Load the old tables into an embedded Postgres on a developer machine and run `01`, `02` and `03` there until all three complete with no `FAIL` rows. No production system is written to.

### Step 2. Run on a Neon branch

A Neon branch is a full copy of the production database that can be written to without affecting production. Run the same files there against the complete data.

### Step 3. Checks that must pass (`03_verify.sql`)

1. Row counts: each new table holds the number of rows its sources predict.
2. Coverage: every user ID present in any old table is present in `users`.
3. Totals: for each tag, the sum of scores and the number of sits match between old and new.
4. Parity: for each student, the MERN Online Assessment, FE Project and Human Interview status and the GenAI Assessment status in the new track tables match `parity_old_dashboard.sql`.
5. No value that was present in an old column is empty in the new column it maps to.
6. Fifty students chosen at random are compared field by field.

### Step 4. Create and copy in production

Run `01` and `02` on production. This adds schema `irp_v2` and reads `public`; the dashboard is unaffected because nothing reads `irp_v2` yet. Requires the product owner's approval.

### Step 5. Switch the code

1. Add the new tables to the Drizzle schema in `lib/db/src/schema/`.
2. Add one function, `evaluateAttempt`, that applies criteria to an attempt, and one function that refills a student's track row from their attempts. These replace the logic in `artifacts/irp-dashboard/src/lib/l1JourneySteps.ts`, `assessment.ts` and `humanInterviewClearance.ts`, and `getAssessmentResultsResponse` in `artifacts/api-server/src/routes/student.ts`.
3. Change the daily sync (`artifacts/api-server/src/lib/sync-bigquery.ts`, `genaiResults.ts`, `humanInterviews.ts`) to write attempt rows, then evaluate, then refill track rows.
4. Change each API route to read the new tables. Response shapes stay the same.
5. Move the hardcoded student ID lists into `student_groups` and delete the source files.
6. Replace the three BigQuery writers with the single job from section 5.6.
7. On release day: stop the API, run `09_rollback.sql`, `01` and `02` again to refresh the copy, run `03`, start the new API.

### Step 6. Delete the old tables

One week after step 5 with no errors: export the 44 old tables to CSV, then drop them.

### Rollback

- Before step 5: run `09_rollback.sql`. Nothing else was changed.
- After step 5 and before step 6: redeploy the previous API version. The old tables are still present and still receive nothing new, so results from the days since the switch would be missing from them; the daily sync refills BigQuery-sourced data, and dashboard-created rows from those days would need to be copied back by hand.
- After step 6: restore from the CSV export.

### Open questions

1. Who in the program team owns pass marks, and does a change need a second approver?
2. Should the write-back to BigQuery include human interview attempts, which BigQuery does not hold today?
3. `activity_logs` grows by about 1,500 rows a day. Should rows older than 90 days be removed from Postgres once they are in BigQuery?
