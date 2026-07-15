# IRP 2.0 Student Dashboard — Full Documentation

Complete reference for engineers, QAs, and ops working on the IRP Dashboard.

| | |
|--|--|
| **Canonical repo path** | `Desktop/IRP 2.0--/IRP-Dashboard/` |
| **UI (local)** | http://localhost:22020 |
| **API (local)** | http://localhost:8080 |
| **Sibling landing** | `Desktop/IRP 2.0--/IRP-2.0/` (port 24079) |

> Prefer **`IRP 2.0--/IRP-Dashboard`**. A second, often stale copy may exist at `Desktop/IRP-Dashboard/`.

**Secrets:** document only env **names**. Never commit `.env` values, private keys, or connection strings.

---

## Table of contents

1. [Product overview](#1-product-overview)
2. [System architecture](#2-system-architecture)
3. [Repository layout](#3-repository-layout)
4. [Getting started](#4-getting-started)
5. [Environment variables](#5-environment-variables)
6. [Domain model (L1 IRP)](#6-domain-model-l1-irp)
7. [Student UI journeys](#7-student-ui-journeys)
8. [Database schema](#8-database-schema)
9. [BigQuery sync](#9-bigquery-sync)
10. [Authentication](#10-authentication)
11. [API reference](#11-api-reference)
12. [Frontend guide](#12-frontend-guide)
13. [Journey state machine](#13-journey-state-machine)
14. [Scripts & tooling](#14-scripts--tooling)
15. [Admin & operations](#15-admin--operations)
16. [Deployment notes](#16-deployment-notes)
17. [Troubleshooting](#17-troubleshooting)
18. [Glossary](#18-glossary)

---

## 1. Product overview

### What students get

After academy SSO, a student lands on a personalised dashboard that shows:

- Current **IRP level** (currently focused on **L1 Hustler**)
- **Online assessment** status & scores (Cycle 1 / Cycle 2)
- **FE Project** and **AI Mock Interview (NxtMock)** progress
- **Journey steps** (what’s done, what’s next)
- Assessment **calendar / slot registration** and time-gated **mock & main** exam links
- Course progress (MCQ / coding) when unlocked
- Help (Contact us) and feedback

### What this system is not

- Not the exam platform itself (Topin / assessment vendor)
- Not the landing/marketing site (that’s `IRP-2.0/`)
- Not a live BigQuery BI tool — the app reads **Postgres** only

### High-level data flow

```
Academy SSO ──► mint forms_auth_token ──► Dashboard UI
                                              │
                                              ▼ /api/*
                                         Express API
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
              Postgres (Neon)          Admin / sync APIs         (optional) analytics
                     ▲
                     │ upsert
              BigQuery sync job
                     ▲
              Academy analytics BQ
```

---

## 2. System architecture

### Runtime packages (pnpm workspace)

| Package | Path | Role |
|---------|------|------|
| `@workspace/api-server` | `artifacts/api-server` | Express 5 API (esbuild bundle) |
| `@workspace/irp-dashboard` | `artifacts/irp-dashboard` | React 19 + Vite 7 UI |
| `@workspace/db` | `lib/db` | Drizzle schema + `drizzle-kit push` |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI + Orval codegen |
| `@workspace/api-zod` | `lib/api-zod` | Generated Zod validators |
| `@workspace/api-client-react` | `lib/api-client-react` | Generated React Query hooks |
| `@workspace/scripts` | `scripts` | CLI sync helpers |

### Ports (local)

| Service | Port |
|---------|------|
| API | **8080** |
| Dashboard UI | **22020** |
| Landing (parent `start-both.sh`) | **24079** |

Vite proxies `/api` → `http://localhost:8080`.

### Design decisions (why)

1. **BQ → Postgres sync** — GCP VPC Service Controls often block live BQ from app hosts. Neon is the stable read path.
2. **OpenAPI-first** — edit `openapi.yaml`, run codegen for Zod + React Query.
3. **Stateless SSO** — every request re-validates `forms_auth_tokens` (no server session store).
4. **L1-only clamp** — journey API forces L1-equivalent states until L2/L3 fully launch.
5. **Authoritative exam access list** — which main assessment link a student sees comes primarily from uploaded `l1_exam_access`, not only self-serve registration.

---

## 3. Repository layout

```
IRP 2.0--/
├── IRP-Dashboard/                 ← THIS PROJECT
│   ├── artifacts/
│   │   ├── api-server/            Express API
│   │   ├── irp-dashboard/         React UI
│   │   └── mockup-sandbox/        Design sandbox
│   ├── lib/
│   │   ├── db/                    Drizzle
│   │   ├── api-spec/              OpenAPI
│   │   ├── api-zod/
│   │   └── api-client-react/
│   ├── scripts/                   sync:bq, etc.
│   ├── docs/                      ← you are here
│   ├── attached_assets/           uploads / reference files
│   ├── .agents/memory/            ops notes
│   ├── .env                       local secrets (gitignored)
│   └── README.md
├── IRP-2.0/                       landing site
└── start-both.sh                  landing + dashboard together
```

### Source-of-truth files

| Concern | File |
|---------|------|
| DB schema | `lib/db/src/schema/student.ts` |
| API contract | `lib/api-spec/openapi.yaml` |
| Online / FE clear rules | `artifacts/irp-dashboard/src/lib/assessment.ts` |
| C1 vs C2 track | `artifacts/irp-dashboard/src/lib/l1StudentTrack.ts` |
| Dates / windows | `artifacts/irp-dashboard/src/lib/irpDates.ts` |
| Post-clear pipeline hero | `artifacts/irp-dashboard/src/lib/l1PipelineStage.ts` |
| Journey (UI) | `artifacts/irp-dashboard/src/lib/journey.ts` |
| Journey (API + clamp) | `artifacts/api-server/src/routes/journey.ts` |
| BQ client | `artifacts/api-server/src/lib/bigquery.ts` |
| Sync upserts | `artifacts/api-server/src/lib/sync-bigquery.ts` |
| Auth resolve | `artifacts/api-server/src/lib/auth.ts` |

---

## 4. Getting started

### Prerequisites

- Node.js **24**
- **pnpm** 11+ (root `preinstall` rejects npm/yarn)
- Root `.env` from a teammate

### Install & run

```bash
cd "IRP 2.0--/IRP-Dashboard"
pnpm install
pnpm --filter @workspace/db run push

# Terminal 1
npm run dev:api          # → :8080

# Terminal 2
npm run dev              # → :22020
```

### Bypass if `pnpm run` fails install checks

```bash
# API
cd artifacts/api-server
node ./build.mjs
NODE_ENV=development node --enable-source-maps ./dist/index.mjs

# UI
cd artifacts/irp-dashboard
PORT=22020 BASE_PATH=/ ./node_modules/.bin/vite --config vite.config.ts --host 0.0.0.0
```

### Important: API does not hot-reload

`dev` = `build` once then `start`. After changing API or DB code:

1. Restart API  
2. If schema changed: `pnpm --filter @workspace/db run push`

### Preview a specific student

```bash
# in .env
ACADEMY_USER_ID=<academy-uuid>
```

Restart API → open http://localhost:22020/

```bash
curl -s http://localhost:8080/api/auth/me
curl -s http://localhost:8080/api/student
curl -s http://localhost:8080/api/student/assessments
```

---

## 5. Environment variables

### Required / common (API)

| Name | Purpose |
|------|---------|
| `DATABASE_URL` | Neon Postgres URL |
| `PORT` | API listen port (`8080`) |
| `ACADEMY_USER_ID` | Dev impersonation UUID (non-prod only) |
| `project_id` | GCP project for BigQuery |
| `client_email` | Service account email |
| `private_key` | SA private key (`\n` escaped) |
| `private_key_id` | SA key id |
| `client_id` | SA client id |
| `token_uri` | Usually Google OAuth token URI |
| `BQ_DATASET` | Dataset containing portal tables |
| `BQ_ASSESSMENT_TABLE` | Optional assessment table override |
| `BQ_NXTMOCK_TABLE` | Optional nxtmock table override |
| `BQ_SYNC_TIMES_IST` | e.g. `10:00,18:00` |
| `BQ_SYNC_ON_BOOT` | `false` to skip boot sync |
| `TOKEN_SECRET` | Partner key for auth-code minting |
| `FORMS_TOKEN_TTL_MINUTES` | Token TTL (default 15) |
| `FORMS_REDIRECT_ORIGIN` / `LEGACY_APP_ORIGIN` | Redirect base after SSO |
| `ANALYTICS_ADMIN_KEY` | Protects admin / sync / analytics |
| `L1_JULY12_REGISTRATION_FORCE_OPEN` | Force July-12 reg open (non-prod) |
| `LOG_LEVEL` / `NODE_ENV` | Logging / prod flags |

### Vite (UI)

| Name | Purpose |
|------|---------|
| `VITE_LOGIN_URL` | SSO login page |
| `VITE_SSO_REQUIRED` | Force SSO even in non-prod |
| `VITE_IRP_LANDING_URL` | Link to landing |
| `VITE_IRP_DASHBOARD_URL` | Canonical dashboard URL |
| `VITE_L1_JULY12_REGISTRATION_FORCE_OPEN` | UI force-open flag (DEV) |

---

## 6. Domain model (L1 IRP)

### Assessment types

| Type | How to recognize | Clear rule |
|------|------------------|------------|
| **Online L1** | Level/tag contains assessment; not FE | Overall ≥ **70%** |
| **FE Project** | Level/tag/title contains FE Project | Perfect score (e.g. **20/20**) |
| **AI Mock (NxtMock)** | `academy_user_nxtmock_details` | Average rating ≥ **5** /10 |

Constant: `ASSESSMENT_CLEAR_THRESHOLD = 70` in `assessment.ts`.

### Cycles & dates

| Term | Date / meaning |
|------|----------------|
| **C1** | 14 June 2026 online sit |
| **C2 (label “5th July”)** | Original Cycle 2 sit / UI date label |
| **12th July** | C2 **re-conduction** for not-yet-cleared |
| DB `cycle` | Often `'C1'` or `'C2'` — July 5 and July 12 may both be `C2` |

Always **exclude FE Project** when counting online C1/C2 attempted/cleared.

### Tracks (`l1StudentTrack.ts`)

```
Online L1 cleared (≥70%)?
  YES → cycle1_cleared track
        → FE Project → AI Mock → Human Interview → L2
  NO  → cycle2_pending track
        → July 12 registration / countdown / reattempt UX
```

| Helper | Meaning |
|--------|---------|
| `isCycle1Cleared()` | Cleared online L1 (**any** cycle) — name is historical |
| `isCycle2Candidate()` | Not yet cleared online L1 |
| `clearedL1ViaC2()` | The clearing sit’s `cycle === 'C2'` |

### July 12 operational windows (`irpDates.ts`)

| Window | IST |
|--------|-----|
| Registration open | 7 Jul 21:00 |
| Registration close | 12 Jul 17:30 |
| Mock link open | 11 Jul 14:00 → 12 Jul 10:00 |
| Main exam link | 12 Jul 18:00 → 12 Jul 20:00 |
| July-12 results unlock | from 13 Jul 00:00 |
| C2 (5 Jul) results unlock label | 10 Jul |

### Official counts (ops) — DB only

```sql
-- Attempted (online C2)
WHERE TRIM(cycle) = 'C2'
  AND level/title not FE
  AND (assessment_user_score IS NOT NULL
       OR mcq_user_section_score IS NOT NULL
       OR coding_user_section_score IS NOT NULL)

-- Cleared
AND assessment_total_score > 0
AND assessment_user_score >= assessment_total_score * 0.7
```

Do **not** use Google Sheets as source of truth for attempts/clears.

---

## 7. Student UI journeys

### Gate order (`App.tsx` → `Home`)

1. **Payment** — if `user_id` in `unpaid_users` → PaymentRequired  
2. **Enrollment** — no IRP rows → NotEnrolled (`NOT_ENROLLED`)  
3. **Onboarding** — first visit → path choice  
4. **Dashboard** — main experience  

### Navigation

| Path | View |
|------|------|
| `/` | Dashboard |
| `/assessments-hub` | Assessments Hub |
| `/assessment-calendar` | Slot booking / calendar |
| `/analytics` | Internal analytics (admin) |

### Cleared student (e.g. C2 95%)

- Hero: pipeline stage (usually **Complete your FE Project**)  
- Journey: Online Assessment = **done**  
- Assessment Results: scores + green **Cleared**  
- No July-12 reattempt hero  

### Attempted not cleared

- Amber hero with % and “need 70%”  
- Results unlocked after unlock dates  
- May show next exam / registration messaging  

### Cohorts

- **July 12 uploaded cohort** (`l1July12Cohort.ts`) — already registered banner  
- **Self-serve registration** → `l1_cycle_registrations`  
- **Exam-platform access list** → `l1_exam_access` (authoritative main link slot)

---

## 8. Database schema

Schema file: `lib/db/src/schema/student.ts`  
Push: `pnpm --filter @workspace/db run push`

### Product / journey

| Table | Purpose |
|-------|---------|
| `students` | Profile + `journeyState`, onboarding, flags |
| `subject_progress` | Per-subject practice totals |
| `student_marks` | Local marks history |
| `student_activity` | Streaks |
| `practice_sessions` | Recent practice |
| `weekly_activity` | Weekly chart |
| `forms_auth_tokens` | SSO tokens |
| `assessment_slots` | Slot catalogue |
| `slot_bookings` | Bookings |
| `slot_notify_requests` | Notify me |
| `l1_cycle_registrations` | Cycle/slot self-registration |
| `l1_exam_access` | Exam-platform access mapping |
| `unpaid_users` | Payment gate list |
| `contact_us_messages` | Help messages |
| `dashboard_feedback` | Ratings |
| `dashboard_analytics_events` | Event stream |

### BigQuery mirrors

| Table | Purpose |
|-------|---------|
| `academy_user_basic_details` | Names |
| `academy_user_assessment_details` | Online + FE scores |
| `academy_user_course_progress` | Course % |
| `academy_user_nxtmock_details` | AI mock ratings |
| `bigquery_sync_status` | Sync health |

#### `academy_user_assessment_details` (key columns)

- `user_id`, `organisation_assessment_id` (unique together)  
- `assessment_title`, `assessment_tag`, `level`, `cycle`  
- `mcq_*`, `coding_*`, `assessment_user_score`, `assessment_total_score`  
- `synced_at`

#### `students` journey-related columns

- `journey_state`, `is_wildcard`, `has_completed_onboarding`  
- `has_attempted_l1`, `l3_exam_started`, `reattempt_date`  
- `project_submitted`, `project_due_date`

---

## 9. BigQuery sync

### Source tables (dataset from `BQ_DATASET`)

| Kind | Preferred / candidates |
|------|------------------------|
| Basic | `academy_users_basic_details_for_irp_portal` |
| Progress | `academy_users_course_progress_data_for_irp_portal` |
| Assessments | physical `academy_users_irp_main_assessment_details_for_irp_portal` → else view `y_academy_users_irp_main_assessment_details_for_irp_portal` |
| NxtMock | physical `…nxtmock…` → else `y_…nxtmock…` |

### How sync runs

1. Resolve credentials from env  
2. Fetch rows from BQ  
3. Batch upsert into Neon (batch size typically 500)  
4. Write `bigquery_sync_status`  

**Triggers**

- Daily IST schedule (`BQ_SYNC_TIMES_IST`, default morning + evening)  
- Optional on boot  
- Manual: `pnpm --filter @workspace/scripts run sync:bq`  
- Manual: `POST /api/sync/bigquery` (admin key)  
- Helpers: `sync-assessment.mjs`, `bq-probe.mjs`

### VPC note

If sync errors mention VPC Service Controls / 403, the SA cannot reach BQ from that network. Ops must adjust GCP policy or run sync from an allowed environment. The product still serves whatever is already in Neon.

---

## 10. Authentication

### Production flow

1. Partner calls `POST /api/auth/generate-auth-code` with `TOKEN_SECRET`  
2. Partner redirects browser to dashboard with `?auth_token=`  
3. UI stores token in `sessionStorage` (`irp_auth_token`) and strips query  
4. Every API call sends `Authorization: Bearer <token>`  
5. API looks up `forms_auth_tokens` and rejects if missing/expired  

### Token sources (server)

1. `Authorization: Bearer`  
2. `x-auth-token`  
3. `?auth_token=`

### Local preview override

When `NODE_ENV !== production` and `ACADEMY_USER_ID` is set, that UUID **wins** for all requests — ideal for UI walkthroughs without SSO.

### Client flags

- `VITE_LOGIN_URL` — where to send users to login  
- In prod, SSO is required unless `VITE_SSO_REQUIRED=false`

---

## 11. API reference

All routes are under **`/api`**.  
Many student routes need a valid auth token (or `ACADEMY_USER_ID` in dev).  
Admin / sync / analytics need `ANALYTICS_ADMIN_KEY` (header patterns used by `checkApiKey`).

### Health

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/healthz` | Liveness |

### Student

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/student` | Profile |
| GET | `/student/progress` | Course / subject progress |
| GET | `/student/assessments` | Assessment rows (+ `hasWrittenAssessment`) |
| GET | `/student/marks` | Marks table |
| GET | `/student/activity` | Activity + weekly |
| POST | `/student/contact` | Contact message |
| POST | `/student/feedback` | Feedback |
| POST | `/student/analytics/event` | Track UI event |
| GET/POST/DELETE | `/student/l1-registration` | Slot registration |
| GET | `/student/l1-exam-access` | Authoritative slot / link |
| GET | `/student/l1-july12-cohort` | Cohort membership flags |
| GET | `/student/nxtmock-interview` | AI mock ratings |
| GET | `/student/payment-status` | Paid gate |

### Journey

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/student/journey` | Current journey (clamped) |
| POST | `/student/journey/onboard` | First path choice |
| POST | `/student/journey/switch` | Switch path |
| POST | `/student/journey/state` | Set state (preview/admin style) |

### Auth

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/generate-auth-code` | Mint token |
| POST | `/auth/generate-auth-code-with-redirect` | Mint + redirect URL |
| GET | `/auth/me` | Who am I |

### Sync

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sync/bigquery` | Run full sync |
| GET | `/sync/status` | Per-table status |

### Academy (lookup)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/academy/users` | List basic details |
| GET | `/academy/users/:userId/progress` | Progress |
| GET | `/academy/users/:userId/assessments` | Assessments |

### Analytics & admin

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/analytics/dashboard` | Aggregates |
| POST | `/admin/students/fe-project-done` | Batch FE / L1 flags |
| POST | `/admin/students/ai-mock-cleared` | Batch AI mock cleared |
| POST | `/admin/students/reset-l1-registration` | Clear registration |
| POST | `/admin/l1-exam-access/import` | Import exam access |
| POST | `/admin/unpaid-users/import` | Import unpaid list |

### Codegen

After editing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

> Live routes may be ahead of OpenAPI — verify against `routes/*.ts`.

---

## 12. Frontend guide

### Stack

React 19, Vite 7, Tailwind v4, Radix/shadcn, TanStack Query, Wouter, Framer Motion, Recharts.

### Key lib modules

| Module | Responsibility |
|--------|----------------|
| `assessment.ts` | Pick sits, clear %, written detection, result labels |
| `l1StudentTrack.ts` | Cleared vs pending tracks |
| `l1PipelineStage.ts` | FE / AI / Human / L2 hero stages |
| `l1JourneySteps.ts` | Journey bar step statuses |
| `irpDates.ts` | All date gates |
| `journey.ts` | Levels, phases, state lists |
| `authToken.ts` | sessionStorage token |
| `nxtmockInterview.ts` | Rating clear helpers |

### Major UI components (`components/irp/`)

`DashboardView`, `Hero`, `Sidebar`, `CountdownRing`, `AssessmentResults`, `FeProjectResults`, `FeProjectCallout`, `FeProjectNotClearedNotice`, `NxtmockResults`, `L1AssessmentBanner`, `L1July12RegisteredBanner`, `L1RegistrationModal`, `SubjectStatsTable`, `ProgressSummary`, `ContactUs`, `FeedbackButton` / `FeedbackSheet`, `SettingsSheet`, `ComingSoonPanel`, `ui`.

### Result locking logic (summary)

`isAssessmentResultsLocked()`:

- No written attempt → locked  
- C2 attempter before C2 unlock date → locked  
- Otherwise L1 written → unlocked  

Both **cleared** and **not cleared** see scores once unlocked (`Cleared` / `Not cleared` pill).

---

## 13. Journey state machine

### States (frontend enum)

**L1:** `L1_PREP`, `L1_EXAM_OPEN`, `L1_REATTEMPT_WAITING`, `L1_REATTEMPT_ACTIVE`, `L1_POST_ASSESSMENT`, `L1_POST_REATTEMPT_*`, `L1_HUMAN_INTERVIEW`  

**L2 / L3:** parallel PREP / EXAM / REATTEMPT / POST patterns  

**Other:** `WILDCARD_ACTIVE`, `PLACED`

### Phases (derived)

`PREP` | `EXAM_OPEN` | `REATTEMPT_*` | `POST_ASSESSMENT` | `WILDCARD` | `PLACED`

### Rules of thumb

- Cleared level often involves `_POST_` in `journeyState`  
- Don’t use phase alone for “cleared” in reattempt edge cases  
- API applies **`clampToL1()`** on read unless user is L3-allowlisted  
- Clearing NxtMock can advance journey toward `L1_HUMAN_INTERVIEW`

---

## 14. Scripts & tooling

| Command / script | Use |
|------------------|-----|
| `pnpm install` | Install (pnpm only) |
| `pnpm run typecheck` | All packages |
| `pnpm run build` | Typecheck + build |
| `pnpm --filter @workspace/db run push` | Apply schema |
| `pnpm --filter @workspace/api-spec run codegen` | Orval regenerate |
| `pnpm --filter @workspace/scripts run sync:bq` | Full BQ sync |
| `artifacts/api-server/sync-assessment.mjs` | Assessments only |
| `artifacts/api-server/bq-probe.mjs` | BQ connectivity |
| `artifacts/api-server/count-stages.mjs` | Stage census SQL |
| `artifacts/api-server/grant-dashboard-access.mjs` | Seed access rows |
| `scripts/materialize-assessment-bq.sql` | BQ materialize helper |
| `scripts/post-merge.sh` | Post-merge install + push |

Root scripts: `dev`, `dev:ui`, `dev:api`, `build`, `typecheck`.

---

## 15. Admin & operations

### Typical ops tasks

| Task | How |
|------|-----|
| Refresh scores | Run BQ sync; check `bigquery_sync_status` |
| Import exam links | `POST /admin/l1-exam-access/import` |
| Block unpaid | `POST /admin/unpaid-users/import` |
| Mark FE done batch | `POST /admin/students/fe-project-done` |
| Mark AI mock cleared | `POST /admin/students/ai-mock-cleared` |
| Reset registration | `POST /admin/students/reset-l1-registration` |
| Analytics | `GET /analytics/dashboard` |

### Enabling L3 preview for a user

Add UUID to `L3_ALLOWED_ACADEMY_USER_IDS` in `artifacts/api-server/src/routes/journey.ts` → **restart API**.

### Enabling L2/L3 for everyone (future)

1. Remove `clampToL1()` read clamp  
2. Normalize DB journey rows  
3. Review write guards that currently force L1 for non-allowlisted users  

---

## 16. Deployment notes

### Replit (high level)

- Node 24, pnpm workspace  
- API mapped around **8080**; UI around **22020** (external mappings vary)  
- Deployment target often `autoscale`  
- `.replitignore` excludes local stores  
- Post-merge hook: `scripts/post-merge.sh`  

### Hard requirements in hosted envs

- Valid `DATABASE_URL`  
- Env secrets for BQ if syncing from that host (may fail under VPC)  
- Never rely on live BQ from UI  

### Parent launcher

From `IRP 2.0--/`:

```bash
bash start-both.sh   # landing :24079 + dashboard :22020
```

(Still need API separately on :8080 for real data.)

---

## 17. Troubleshooting

### How to check a user error in production (Replit)

API logs are **JSON on stdout** (Pino). In Replit: **Deployments → [your autoscale deployment] → Logs**.

**Ask the user for:**

1. Academy user UUID (or email so you can look up `user_id`)
2. Approximate time (**IST**)
3. Page URL / screenshot
4. The **Ref:** value on the error screen (this is `X-Request-Id`)

**Then in prod logs, search for:**

```text
"academyUserId":"<uuid>"
```

or

```text
"req":{"id":"<request-id-from-Ref>"
```

or

```text
"Failed to
```

Same request id appears on the HTTP access line and the `req.log.error` line when a route fails.

Optional env: set `LOG_LEVEL=debug` temporarily for noisier logs (restart API after changing).

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Scores missing / old | Sync stale or failed | Check `bigquery_sync_status`; run sync |
| `NOT_ENROLLED` | No basic/assessment rows | Sync or grant access script |
| Payment wall | UUID in `unpaid_users` | Remove from unpaid import |
| Wrong student in local | Stale `ACADEMY_USER_ID` / SSO token | Set env, restart API, clear sessionStorage |
| pnpm “Use pnpm instead” | Nested install with wrong agent | Run node/vite binaries directly |
| API change not visible | No HMR | Rebuild + restart API |
| “Live now” before exam | Missing date gate | Use `irpDates` helpers |
| C2 clear shows “5th July” | Label maps all C2 to that constant | Known limitation; July 5 vs 12 share `cycle=C2` |
| FE counted as online clear | Forgot FE filter | Exclude FE-PROJECT in queries / use `isL1OnlineAssessment` |
| BQ 403 / VPC | Org Service Controls | Sync from allowed network; don’t query BQ from UI |

### Debug checklist

```bash
curl -s http://localhost:8080/api/healthz
curl -s http://localhost:8080/api/auth/me
curl -s http://localhost:8080/api/sync/status   # needs admin key
```

SQL:

```sql
SELECT * FROM bigquery_sync_status ORDER BY table_name;
SELECT cycle, assessment_user_score, assessment_total_score, level
FROM academy_user_assessment_details
WHERE user_id = '<uuid>';
```

---

## 18. Glossary

| Term | Definition |
|------|------------|
| **IRP** | Industry Readiness Program |
| **L1 Hustler** | First level currently live for most users |
| **C1 / C2** | Online assessment cycles |
| **Cleared (online)** | ≥70% overall |
| **FE Project** | Front-end project stage; perfect score to clear |
| **NxtMock** | AI Mock Interview |
| **cycle1_cleared track** | Post-clear pipeline (FE → AI → Human) |
| **cycle2_pending track** | Still needs to clear online L1 |
| **July 12 re-conduction** | Extra sitting for pending students |
| **Exam access list** | Uploaded mapping of who gets which main link |
| **Clamp** | Force journey display to L1 |
| **SSO token** | Short-lived row in `forms_auth_tokens` |

---

## Related reading

| Doc | Path |
|-----|------|
| Quick start | [`../README.md`](../README.md) |
| Short onboarding | [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md) |
| BQ VPC | `.agents/memory/bigquery-vpc-blocker.md` |
| Dev seeding | `.agents/memory/dev-seeding-flow.md` |
| L1 gate | `.agents/memory/l1-only-gate.md` |
| Exam access | `.agents/memory/l1-exam-access-authoritative-list.md` |
| Hero dates | `.agents/memory/hero-live-date-gating.md` |
| Admin key | `.agents/memory/analytics-admin-key-auth.md` |
| Memory index | `.agents/memory/MEMORY.md` |

---

*Last updated for engineering handoff — keep date labels and sync schedules aligned with product announcements when they change.*
