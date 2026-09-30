---
name: Manual dashboard access overrides
description: How explicit admin dashboard grants and revocations interact with the synced payment and eligibility mirror.
---

An explicit admin dashboard grant or revocation must be evaluated as a separate access override. Do not rewrite the BigQuery-synced payment/eligibility fields, and do not infer "paid" merely because a user is absent from the legacy unpaid list. Assessment-stage links remain controlled by Access Loader.

**Why:** The admin grant stored an explicit marker for a student whose synced record remained `UNPAID` and `NOT_ELIGIBLE`; the dashboard gate ignored the marker and continued to block access.

**How to apply:** Preserve grant/revoke precedence in the payment-access resolver and update both the admin API and panel together. When debugging a grant, check the exact Academy User ID and its override marker in the environment where the student signs in.