# IRP Dashboard — Developer Guide

Friendly onboarding guide for engineers joining this repo.

- **Full reference (recommended):** [`DOCUMENTATION.md`](./DOCUMENTATION.md)  
- Quick start / stack: root [`README.md`](../README.md)

---

## 1. What is this product?

**IRP 2.0 Student Dashboard** is a personalised portal where students:

1. Sign in via academy SSO  
2. See **Level 1 (Hustler)** status (L2/L3 mostly gated for now)  
3. Track **online assessment**, **FE Project**, **AI Mock Interview**, and next steps  
4. Book / view assessment slots and open mock/main exam links when live  

Data on the screen comes from **Postgres (Neon)**. Postgres is kept up to date by a **BigQuery → Postgres sync** (live BQ from many environments is blocked by org VPC controls).

---

## 2. Mental model (read this first)

```
SSO / ACADEMY_USER_ID (dev)
        │
        ▼
   Express API (:8080)
        │
        ├── Postgres (Neon)  ◄── BigQuery sync (daily IST)
        │      • academy_user_*     (scores, progress, names)
        │      • l1_cycle_registrations, l1_exam_access
        │      • students / journey / unpaid_users / …
        │
        ▼
   React UI (:22020)  — proxied /api → :8080
```

**Rule of thumb:** the UI almost never talks to BigQuery directly. If scores look stale, **sync Postgres**, don’t debug the React tree first.

---

## 3. Repo map

Canonical folder (use this one):

`Desktop/IRP 2.0--/IRP-Dashboard/`

> ⚠️ There may be another copy at `Desktop/IRP-Dashboard/`. Prefer **`IRP 2.0--/IRP-Dashboard`**.

| Path | What it is |
|------|------------|
| `artifacts/api-server/` | Express API |
| `artifacts/irp-dashboard/` | React + Vite UI |
| `artifacts/mockup-sandbox/` | Design playground (not production) |
| `lib/db/` | Drizzle schema (`@workspace/db`) |
| `lib/api-spec/` | OpenAPI source of truth |
| `lib/api-zod/` | Generated Zod validators |
| `lib/api-client-react/` | Generated React Query hooks |
| `scripts/` | `sync:bq` and helpers |
| `docs/` | This guide |
| `.agents/memory/` | Ops notes (VPC, auth, gates) |
| `attached_assets/` | One-off uploads / reference CSVs |

Parent folder also has:

- `IRP-2.0/` — marketing/landing site  
- `start-both.sh` — starts landing + dashboard together  

### Files you will touch most

| Concern | File |
|---------|------|
| DB tables | `lib/db/src/schema/student.ts` |
| API contract | `lib/api-spec/openapi.yaml` |
| Assessment / clear logic | `artifacts/irp-dashboard/src/lib/assessment.ts` |
| C1 vs C2 track | `artifacts/irp-dashboard/src/lib/l1StudentTrack.ts` |
| Exam / unlock dates | `artifacts/irp-dashboard/src/lib/irpDates.ts` |
| Hero copy by pipeline stage | `artifacts/irp-dashboard/src/lib/l1PipelineStage.ts` |
| Journey state | `artifacts/irp-dashboard/src/lib/journey.ts` + `artifacts/api-server/src/routes/journey.ts` |
| BQ sync | `artifacts/api-server/src/lib/sync-bigquery.ts` |

---

## 4. Local setup

**Prereqs:** Node 24, **pnpm** 11+ (npm/yarn are blocked by a root `preinstall` script).

```bash
cd "IRP 2.0--/IRP-Dashboard"
pnpm install
pnpm --filter @workspace/db run push   # first time / after schema edits

# Terminal 1 — API → http://localhost:8080
npm run dev:api

# Terminal 2 — UI → http://localhost:22020
npm run dev
```

UI proxies `/api` → `http://localhost:8080` (`artifacts/irp-dashboard/vite.config.ts`).

### If `pnpm run …` fails with “Use pnpm instead”

Sometimes nested install checks confuse the agent/scripts. Bypass by running binaries directly:

```bash
# API
cd artifacts/api-server && node ./build.mjs && NODE_ENV=development node ./dist/index.mjs

# UI
cd artifacts/irp-dashboard && PORT=22020 BASE_PATH=/ ./node_modules/.bin/vite --config vite.config.ts --host 0.0.0.0
```

### Environment variables (names only — never commit secrets)

Put a root `.env` (gitignored). Important keys:

| Key | Purpose |
|-----|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `PORT` | API port (use `8080`) |
| `ACADEMY_USER_ID` | Dev: impersonate this student UUID for all API calls |
| `project_id`, `client_email`, `private_key`, … | GCP service account for BigQuery |
| `BQ_DATASET` | BigQuery dataset id |
| `BQ_SYNC_TIMES_IST` | Daily sync times (code default ~`10:00,18:00` IST) |
| `BQ_SYNC_ON_BOOT` | Set `false` to skip sync on API start |
| `ANALYTICS_ADMIN_KEY` | Protects admin / sync / analytics routes |
| `L1_JULY12_REGISTRATION_FORCE_OPEN` | Dev: force July-12 registration window open |
| `VITE_L1_JULY12_REGISTRATION_FORCE_OPEN` | Same flag for the UI |

---

## 5. Domain glossary (IRP L1)

### Cycles

| Term | Meaning |
|------|---------|
| **C1 / Cycle 1** | First online L1 sit — **14 June 2026** |
| **C2 / Cycle 2** | Second online L1 sit family in BigQuery (`cycle = 'C2'`) |
| **5th July** | Original C2 marketing / results date label in UI constants |
| **12th July** | C2 **re-conduction** for students who hadn’t cleared yet |

Both July 5 and July 12 attempts are often stored as `cycle = 'C2'` in `academy_user_assessment_details`. When counting “C2 attempted/cleared”, exclude FE Project rows.

### Clear rules

| Assessment | Cleared when |
|------------|--------------|
| Online L1 (C1/C2) | Overall score ≥ **70%** of total (`ASSESSMENT_CLEAR_THRESHOLD`) |
| FE Project | Perfect score (e.g. **20/20**) — partial = attempted not cleared |
| AI Mock (NxtMock) | Average rating ≥ **5** |

### Two student tracks (`l1StudentTrack.ts`)

```
hasClearedAssessment(L1)? 
   yes → cycle1_cleared   → FE Project → AI Mock → Human Interview → L2
   no  → cycle2_pending   → July 12 re-attempt UI / registration / countdown
```

Naming note: `isCycle1Cleared()` means **“cleared online L1 (any cycle)”**, not “cleared only on 14 June”.  
`clearedL1ViaC2()` means the sit that cleared them has `cycle = C2`.

### What C2-cleared students see

- Green / pipeline **hero** (usually “Complete your FE Project”)  
- Journey step: Online Assessment = **done**  
- **Assessment Results** card unlocked (overall / MCQ / coding + Cleared pill)  
- No July-12 reattempt countdown  

### What attempted-not-cleared students see

- Amber hero with % score + “need 70% to clear”  
- Results card still shows scores once unlock dates have passed  
- Messages about re-attempt / next exam date (until they clear)

### July 12 windows (`irpDates.ts`)

| Window | When (IST) |
|--------|------------|
| Mock link | 11 Jul 14:00 → 12 Jul 10:00 |
| Main exam link | 12 Jul 18:00 → 12 Jul 20:00 |
| Results unlock (July 12) | from 13 Jul 00:00 |
| C2 results unlock (5 Jul sit) | from 10 Jul 00:00 |

Always date-gate “live now” copy with helpers in `irpDates.ts` — never journey phase alone.

---

## 6. Data model (Postgres)

### Synced from BigQuery (source of truth for scores)

| Table | Contents |
|-------|----------|
| `academy_user_basic_details` | `user_id`, `user_name` |
| `academy_user_assessment_details` | Online + FE assessment rows (`cycle`, scores, title, tag, level) |
| `academy_user_course_progress` | Course MCQ/coding completion % |
| `academy_user_nxtmock_details` | AI mock ratings |
| `bigquery_sync_status` | Last sync success/error per table |

### Written by the product

| Table | Contents |
|-------|----------|
| `students` + journey fields | Profile / journey state |
| `l1_cycle_registrations` | Self-serve slot registration (e.g. July 12) |
| `l1_exam_access` | Authoritative exam-platform slot → main link (uploaded list) |
| `unpaid_users` | Dashboard payment gate |
| `dashboard_analytics_events` | Click / visit analytics |
| `forms_auth_tokens` | SSO bearer tokens |

### How we defined “C2 attempted / cleared” (ops queries)

```sql
-- Online L1 only (exclude FE Project)
WHERE TRIM(cycle) = 'C2'
  AND UPPER(COALESCE(level,'')) NOT LIKE '%FE-PROJECT%'
  AND UPPER(COALESCE(assessment_title,'')) NOT LIKE '%FE PROJECT%'

-- Attempted
AND (
  assessment_user_score IS NOT NULL
  OR mcq_user_section_score IS NOT NULL
  OR coding_user_section_score IS NOT NULL
)

-- Cleared
AND assessment_total_score > 0
AND assessment_user_score >= assessment_total_score * 0.7
```

Do **not** use Google Sheets for official counts — use these DB tables after a successful sync.

---

## 7. BigQuery sync

1. API uses the GCP service-account env vars.  
2. Upserts the four `academy_user_*` tables in batches.  
3. Runs on a **daily IST schedule** (and optionally on boot).  
4. Failures are recorded in `bigquery_sync_status` and logged — they should not crash the API.

**Manual full sync:**

```bash
pnpm --filter @workspace/scripts run sync:bq
# or (if pnpm filter install fails)
cd scripts && ./node_modules/.bin/tsx ./src/sync-bigquery.ts
# (env must be loaded before @workspace/db imports)
```

**Assessment-only (faster, batched):**

```bash
cd artifacts/api-server && node sync-assessment.mjs
```

**Probe connectivity:**

```bash
cd artifacts/api-server && node bq-probe.mjs
```

**HTTP (needs admin key):** `POST /api/sync/bigquery`

### Known gotcha — VPC Service Controls

Org policy can block BQ from some runtimes (403 / VPC SC). Design assumes **sync into Neon**, then all reads from Postgres. See `.agents/memory/bigquery-vpc-blocker.md`.

---

## 8. Auth & local preview

### Production

Bearer token (`Authorization`) or `x-auth-token` → row in `forms_auth_tokens` (unexpired).

### Local preview of a specific student

1. Set in `.env`:

   ```bash
   ACADEMY_USER_ID=<academy-uuid>
   ```

2. Restart the API (no HMR).  
3. Open `http://localhost:22020/`.

In non-production, `ACADEMY_USER_ID` **overrides** SSO for every request — useful for walking UI states.

Confirm identity:

```bash
curl -s http://localhost:8080/api/auth/me
curl -s http://localhost:8080/api/student
curl -s http://localhost:8080/api/student/assessments
```

Example preview users (documented in `.env` comments, not secrets):

| Scenario | Note |
|----------|------|
| C2 cleared ~95%, FE pending | `467c16a4-…` |
| Attempted not cleared | `00bcd597-…` / `009bdb31-…` |
| FE cleared → AI Mock | several IDs listed in `.env` |

If student / assessment rows are missing → API returns **`NOT_ENROLLED`**. Fix by syncing BQ or using `grant-dashboard-access.mjs` for access-only seeds.

---

## 9. API surface (high level)

Mounted under `/api`:

| Area | Module | Examples |
|------|--------|----------|
| Health | `routes/health.ts` | `GET /healthz` |
| Student | `routes/student.ts` | `/student`, `/assessments`, L1 registration, July-12 cohort, payment |
| Journey | `routes/journey.ts` | get / onboard / state |
| Auth | `routes/auth.ts` | generate code, `/auth/me` |
| Sync | `routes/sync.ts` | `POST /sync/bigquery` (API key) |
| Admin | `routes/admin.ts` | exam-access import, unpaid list, resets |
| Analytics | `routes/analytics.ts` | dashboard aggregates |

OpenAPI → Orval regenerates clients:

```bash
pnpm --filter @workspace/api-spec run codegen
```

> Not every live route may be fully reflected in OpenAPI yet — check `routes/*.ts` when in doubt.

---

## 10. Frontend structure

**App gates (order):** payment → not enrolled → onboarding → dashboard.

**Main UI pieces:**

- `pages/Dashboard.tsx` / `components/irp/DashboardView.tsx` — home  
- `components/irp/Hero.tsx` — big status banner  
- `components/irp/AssessmentResults.tsx` — score cards  
- `components/irp/FeProjectResults.tsx` / `NxtmockResults` — post-L1 pipeline  
- `pages/AssessmentsHub.tsx`, `BookSlot.tsx` — calendar / slots  
- `pages/Analytics.tsx` — internal analytics (admin key)

**L1 journey steps** are built in `l1JourneySteps.ts` from assessment + nxtmock data.

---

## 11. Common workflows

### “Scores look wrong / missing”

1. Check `bigquery_sync_status` for errors / `last_synced_at`.  
2. Run assessment sync.  
3. Confirm rows in `academy_user_assessment_details` for that `user_id`.  
4. Restart API if you changed sync or mapping code.

### “Change exam dates / unlock windows”

Edit `artifacts/irp-dashboard/src/lib/irpDates.ts` (and mirror dates in API `l1Registration.ts` if registration windows move). Restart UI; restart API if server-side gates use the same dates.

### “Preview another student”

Change `ACADEMY_USER_ID` → restart API → hard-refresh UI.

### “Schema change”

1. Edit `lib/db/src/schema/student.ts`  
2. `pnpm --filter @workspace/db run push`  
3. Restart API  

### “Add an API field the UI needs”

1. Update `openapi.yaml`  
2. `pnpm --filter @workspace/api-spec run codegen`  
3. Implement route + types  
4. Restart API  

---

## 12. Useful scripts

| Script | Use |
|--------|-----|
| `scripts` → `sync:bq` | Full BQ → Postgres |
| `artifacts/api-server/sync-assessment.mjs` | Assessments only |
| `artifacts/api-server/bq-probe.mjs` | Can we read BQ? |
| `artifacts/api-server/count-stages.mjs` | Census of C1/C2/FE stages |
| `artifacts/api-server/grant-dashboard-access.mjs` | Seed access rows from UUID list |
| `scripts/materialize-assessment-bq.sql` | BQ materialize helper (admin) |

---

## 13. Architecture decisions (why)

1. **BQ → PG sync** — org VPC often blocks live BQ; Neon is the read path.  
2. **OpenAPI-first** — shared contract for Zod + React Query.  
3. **Journey state strings** — e.g. `L1_PREP`, `L1_POST_…`; level/phase derived in `journey.ts`.  
4. **L1-only clamp** — read-side clamp in journey API until L2/L3 go live.  
5. **Exam access list** — topin/exam-platform upload into `l1_exam_access` is authoritative for which main link a student gets (not only self-serve registration).

---

## 14. Gotchas checklist

- [ ] Use **pnpm**, not npm/yarn  
- [ ] API **does not hot-reload** — rebuild/restart after backend changes  
- [ ] Prefer **`IRP 2.0--/IRP-Dashboard`** over the older Desktop sibling copy  
- [ ] **C2 date labels:** 5 July vs 12 July are different UX dates; DB cycle may still be `C2` for both  
- [ ] Exclude **FE Project** when counting online C1/C2 clears  
- [ ] Online clear ≠ FE clear ≠ NxtMock clear (three different rules)  
- [ ] “Assessment is live” must use **date helpers**, not journey phase alone  
- [ ] Stale scores → **sync**, then look at UI  
- [ ] `getLevel()` unknown states → defaults to **1** while L1 gate is on  

---

## 15. Where to dig deeper

| Topic | Location |
|-------|----------|
| Quick start / stack | [`README.md`](../README.md) |
| VPC / BQ blockers | `.agents/memory/bigquery-vpc-blocker.md` |
| Dev seeding / preview | `.agents/memory/dev-seeding-flow.md` |
| L1-only gate | `.agents/memory/l1-only-gate.md` |
| Exam access list | `.agents/memory/l1-exam-access-authoritative-list.md` |
| Hero date gating | `.agents/memory/hero-live-date-gating.md` |
| Admin API key | `.agents/memory/analytics-admin-key-auth.md` |

---

## 16. Suggested first day

1. Clone / open **`IRP 2.0--/IRP-Dashboard`**.  
2. Get a working root `.env` from a teammate (never commit it).  
3. `pnpm install` → `db push` → start API + UI.  
4. Set `ACADEMY_USER_ID` to a known cleared / not-cleared / FE-pending ID and walk the dashboard.  
5. Read `assessment.ts`, `l1StudentTrack.ts`, `irpDates.ts`.  
6. Run `bq-probe.mjs` and glance at `bigquery_sync_status`.  
7. Skim `.agents/memory/MEMORY.md` for current ops truth.

Welcome aboard 👋
