---
name: Dashboard status policy
description: User-required three-status admission rule and authoritative source handling.
---

Dashboard admission requires only `irp_eligible_status = ELIGIBLE`, `lp_status = ACTIVE`, and `product_status = ACTIVE`. Payment status, including “not explicitly unpaid,” must not be used as a dashboard restriction. Historical manual grants and revocations must not override the three source statuses.

**Why:** The user explicitly requested these three conditions instead of the prior payment-based restriction and selected “Use only three statuses” when asked about manual overrides.

**How to apply:** Compare normalized status values exactly. Missing or unrecognized required statuses must not grant normal access. Sync each student's actual authoritative source values; do not bulk set statuses to ACTIVE or ELIGIBLE to unlock users.

Check BigQuery for the authenticated student's updated access statuses on every app load; scheduled mirror refreshes are not sufficient for this admission check.

**Why:** The user explicitly requested an app-load BigQuery check instead of waiting for the next scheduled sync.

**How to apply:** Fetch only that student's status fields, bypass result/HTTP caches, retain the three-status rule, and show a retryable verification error on failure rather than granting access from old mirror values. Other dashboard data still uses the mirror.
