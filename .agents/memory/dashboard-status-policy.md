---
name: Dashboard status policy
description: User-required three-status admission rule and authoritative source handling.
---

Normal dashboard admission requires `irp_eligible_status = ELIGIBLE`, `lp_status = ACTIVE`, and `product_status = ACTIVE`. Payment status, including “not explicitly unpaid,” must not be used as a dashboard restriction. An admin manual grant is an explicit exception: allow it before querying BigQuery, including during warehouse failures.

**Why:** The user originally selected only three statuses, then explicitly changed that policy to let internal Academy User IDs use admin-issued manual grants.

**How to apply:** Check the manual grant first; otherwise compare normalized status values exactly. Missing or unrecognized required statuses must not grant normal access. Keep source statuses unchanged. Revocation removes only the manual sentinel, not the enrollment record or assessment links; Access Loader still controls links.

Check BigQuery for the authenticated student's updated access statuses on every app load; scheduled mirror refreshes are not sufficient for this admission check.

**Why:** The user explicitly requested an app-load BigQuery check instead of waiting for the next scheduled sync.

**How to apply:** For students without manual grants, fetch only that student's status fields, bypass result/HTTP caches, retain the three-status rule, and show a retryable verification error on failure rather than granting access from old mirror values. Other dashboard data still uses the mirror.
