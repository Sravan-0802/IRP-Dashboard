# IRP 2.0 — Student Dashboard

A personalised progress dashboard for IRP (Industry Readiness Program) 2.0 students. Students log in via SSO and see their current level (L1/L2/L3), assessment status, course progress synced from BigQuery, and next steps in their journey — all in one place.

---

## Quick Start (Local Dev)

**Prerequisites:** Node 24, pnpm 11+, a `.env` file at the repo root (see below).

```bash
# 1. Install dependencies (from IRP-Dashboard/)
pnpm install

# 2. Push DB schema (first time or after schema changes)
pnpm --filter @workspace/db run push

# 3. Start the API server  →  http://localhost:8080
pnpm --filter @workspace/api-server run dev

# 4. Start the dashboard UI  →  http://localhost:22020
PORT=22020 BASE_PATH=/ pnpm --filter @workspace/irp-dashboard run dev
```

Or use the workspace-level script from the root of the repo to start both the landing site and dashboard together:

```bash
bash start-both.sh
```

---

## Repository Layout

```
IRP 2.0--/
├── IRP-Dashboard/                 # Main workspace (this README)
│   ├── artifacts/
│   │   ├── api-server/            # Express 5 API (port 8080)
│   │   └── irp-dashboard/         # React + Vite UI (port 22020)
│   ├── lib/
│   │   ├── db/                    # Drizzle ORM schema + migrations
│   │   ├── api-spec/              # OpenAPI spec (source of truth)
│   │   ├── api-zod/               # Generated Zod schemas from spec
│   │   └── api-client-react/      # Generated React Query hooks from spec
│   ├── scripts/                   # Utility scripts (post-merge, etc.)
│   └── .env                       # Local secrets (never committed)
│
└── IRP-2.0/                       # Landing site (separate workspace)
    └── artifacts/irp/             # Vite app (port 24079)
```

**Source-of-truth files:**
- DB schema → `lib/db/src/schema/student.ts`
- API contract → `lib/api-spec/openapi.yaml`
- Journey state machine → `artifacts/irp-dashboard/src/lib/journey.ts`
- Exam / results dates → `artifacts/irp-dashboard/src/lib/irpDates.ts`
- UI theme tokens → `artifacts/irp-dashboard/src/index.css`

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 |
| Package manager | pnpm workspaces |
| API | Express 5 |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| API codegen | Orval (OpenAPI → Zod + React Query hooks) |
| API build | esbuild (single ESM bundle) |
| UI | React 19, Vite 7, Tailwind CSS v4 |
| UI components | Radix UI primitives + shadcn/ui |
| State / data | TanStack React Query |
| Routing | Wouter |
| Charts | Recharts |
| Animation | Framer Motion |

---

## Environment Variables (`.env`)

```bash
# PostgreSQL (Neon)
DATABASE_URL=postgresql://...

# API server
PORT=8080

# Dev: which SSO user to impersonate (bypasses token check outside prod)
ACADEMY_USER_ID=<uuid>

# BigQuery sync
project_id=...
private_key="-----BEGIN PRIVATE KEY-----\n..."
client_email=...@....iam.gserviceaccount.com
client_id=...
token_uri=https://oauth2.googleapis.com/token
BQ_DATASET=academy_student_success_pocs
BQ_SYNC_INTERVAL_MINUTES=60

# Level 3 allowlist — users who bypass the L1-only clamp (see below)
# L3_ALLOWED_ACADEMY_USER_IDS is set inside journey.ts directly (not env)
```

---

## Architecture Decisions

**1. BigQuery → Postgres sync pipeline**
BigQuery is blocked from Replit/prod by GCP org-level VPC Service Controls (returns 403 regardless of credentials). The dashboard therefore syncs `academy_user_basic_details` and `academy_user_course_progress` into Postgres on a schedule (`BQ_SYNC_INTERVAL_MINUTES`, default 60 min). The dashboard reads from Postgres only. Sync failures log but never crash the server. To re-enable live BQ queries, a GCP admin must grant the service account egress access.

**2. OpenAPI-first API contract**
`lib/api-spec/openapi.yaml` is the single contract. Zod schemas (`lib/api-zod`) and React Query hooks (`lib/api-client-react`) are generated from it via Orval. Run codegen after editing the spec:
```bash
pnpm --filter @workspace/api-spec run codegen
```

**3. Journey state machine**
Every student has a `journeyState` string (e.g. `L1_PREP`, `L2_EXAM_OPEN`, `WILDCARD_ACTIVE`). The state encodes both the level and the sub-phase. `getLevel()` and `getPhase()` in `journey.ts` derive UI from it. Key rule: a level is *cleared* when `journeyState.includes("_POST_")` — do NOT rely on `getPhase()` alone for this (see Gotchas).

**4. L1-only gate (temporary)**
By product decision, only Level 1 is live right now. All stored states are clamped to their L1 equivalent on every `/api/student/journey` read via `clampToL1()` in `journey.ts`. This is a **read-side clamp** — the DB is not mutated. To allow specific users to see their real level (L3 preview), add their academy user ID to `L3_ALLOWED_ACADEMY_USER_IDS` in `artifacts/api-server/src/routes/journey.ts`.

**5. SSO auth is stateless**
No session is stored server-side. Every request re-validates the `Authorization: Bearer <token>` header against the `forms_auth_tokens` table. In non-production, `ACADEMY_USER_ID` env var is used as a fallback identity.

---

## Key Commands

```bash
# Full typecheck (all packages)
pnpm run typecheck

# Typecheck a single package
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/irp-dashboard run typecheck

# Build everything
pnpm run build

# Push DB schema changes (dev/staging only)
pnpm --filter @workspace/db run push

# Regenerate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

---

## Enabling Level 3 for Specific Users

Open `artifacts/api-server/src/routes/journey.ts` and add the academy user ID(s) to the allowlist, then **restart the API server**:

```ts
const L3_ALLOWED_ACADEMY_USER_IDS = new Set<string>([
  "b9cb1e60-b9f7-4c67-8940-e76b526ba9c0",  // example
]);
```

After adding IDs, restart the API server so the new bundle takes effect:
```bash
# Kill port 8080 and rerun
lsof -ti:8080 | xargs kill -9
pnpm --filter @workspace/api-server run dev
```

---

## Enabling L2 / L3 for Everyone (When It Goes Live)

1. Remove `clampToL1()` and revert `serialize()` in `journey.ts` to pass through `journeyState`/`isWildcard` directly.
2. Run a one-time DB normalization to fix any stale wildcard/L3 rows in production.
3. Review the wildcard-onboarding and state-set write guards — they currently block non-L1 writes for non-allowlisted users.

---

## Gotchas

**API server does not hot-reload.** The dev script bundles once at startup (`pnpm run build && pnpm run start`). After changing any source file in `artifacts/api-server/` or `lib/db/`, you must restart the server and (if schema changed) run `pnpm --filter @workspace/db run push`.

**Journey "cleared" detection.** Use `journeyState.includes("_POST_")` to test if an assessment level is cleared. `getPhase()` alone is ambiguous for post-reattempt states, which map to `REATTEMPT_*` — identical to pre-clear reattempt states.

**Hero "live" UI must be date-gated.** The hero's "Assessment is live" copy must be gated on `isAssessmentLive(now)` from `lib/irpDates.ts`, not journey phase alone. Showing "live" before the actual exam date was a confirmed bug.

**BigQuery will always 403** until a GCP admin adds an ingress rule for the service account. Do not attempt live BQ queries in Replit or Neon-hosted environments.

**`getLevel()` defaults to `1`**, not `3`. Any unrecognised state resolves to Level 1 on the frontend. This is intentional while the L1 gate is active.
