---
name: BigQuery VPC blocker
description: Why IRP BigQuery data is synced into Postgres rather than queried live, and how the sync pipeline behaves.
---

# BigQuery is blocked from Replit by VPC Service Controls

Every BigQuery request from the Replit environment (dev AND deployed prod) is rejected with:
`403 — VPC Service Controls: Request is prohibited by organization's policy.`

This affects **all** operations — `getDatasets`, `getTables`, INFORMATION_SCHEMA, and plain `SELECT 1` query jobs, across every region tested. The service-account credentials authenticate fine; the request is denied because Replit's egress is outside the org's allowed perimeter.

**Why:** It is an organization-level Google Cloud policy. It cannot be bypassed in code — that is the entire purpose of the policy. Resolution requires a GCP admin to add an ingress rule / access level for the service account or Replit's egress.

**How to apply:** Do not expect live BigQuery queries to work until the user confirms VPC access was granted. The chosen design (user decision) is to **sync** the two BigQuery tables into the app's Postgres on a schedule, so the dashboard reads from Postgres, not BigQuery.

## Durable design decisions
- Service-account creds come from individual env secrets (`project_id`, `private_key`, `client_email`, etc.) — NOT a single JSON file. `private_key` must have its `\n` unescaped before use.
- Dataset name is unknown (listing is VPC-blocked): resolved from `BQ_DATASET` env var, else auto-discovered by scanning datasets for the known table names — auto-discovery only works once VPC is unblocked.
- Sync is upsert-only (no prune of rows deleted in BigQuery). Per-table isolation: one table's failure must not block the other. Failures log but never crash the server (expected while VPC blocks access).
- Tunables via env: `BQ_SYNC_INTERVAL_MINUTES` (default 60).
