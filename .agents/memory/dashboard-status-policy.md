---
name: Dashboard status policy
description: User-required three-status admission rule and authoritative source handling.
---

Dashboard admission requires only `irp_eligible_status = ELIGIBLE`, `lp_status = ACTIVE`, and `product_status = ACTIVE`. Payment status, including “not explicitly unpaid,” must not be used as a dashboard restriction. Historical `manual-access-grant` / `manual-access-revoke` rows (old bulk imports) must not override the three source statuses. Assessment rows are not required for admission.

**Exception (user-requested 2026-11-11):** admins can grant dashboard access to specific UIDs from the admin Dashboard access panel. Those grants are stored as `dashboard-access-override` rows in `academy_user_assessment_details` and bypass the three statuses; "Remove manual access" deletes them. Do not remove this feature or fold the legacy `manual-access-grant` rows into it.

**Why:** The user explicitly requested these three conditions instead of the prior payment-based restriction, and later asked for a manual admin grant for internal UIDs without reviving thousands of old bulk grants.

**How to apply:** Check the manual grant first; otherwise compare normalized status values exactly. Missing or unrecognized required statuses must not grant normal access. Keep source statuses unchanged. Revocation removes only the manual sentinel, not the enrollment record or assessment links; Access Loader still controls links.

Check BigQuery for the authenticated student's updated access statuses on every app load; scheduled mirror refreshes are not sufficient for this admission check.

**Why:** The user explicitly requested an app-load BigQuery check instead of waiting for the next scheduled sync.

**How to apply:** For students without manual grants, fetch only that student's status fields, bypass result/HTTP caches, retain the three-status rule, and show a retryable verification error on failure rather than granting access from old mirror values. Other dashboard data still uses the mirror.
