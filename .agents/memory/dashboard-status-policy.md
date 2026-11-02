---
name: Dashboard status policy
description: User-required three-status admission rule and authoritative source handling.
---

Dashboard admission requires only `irp_eligible_status = ELIGIBLE`, `lp_status = ACTIVE`, and `product_status = ACTIVE`. Payment status, including “not explicitly unpaid,” must not be used as a dashboard restriction. Historical manual grants and revocations must not override the three source statuses.

**Why:** The user explicitly requested these three conditions instead of the prior payment-based restriction and selected “Use only three statuses” when asked about manual overrides.

**How to apply:** Compare normalized status values exactly. Missing or unrecognized required statuses must not grant normal access. Sync each student's actual authoritative source values; do not bulk set statuses to ACTIVE or ELIGIBLE to unlock users.
