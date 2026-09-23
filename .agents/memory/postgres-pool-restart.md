---
name: PostgreSQL pool restart handling
description: Managed PostgreSQL restarts can terminate idle clients while the API is serving token requests.
---

Managed PostgreSQL restarts may emit an idle-client pool error with `terminating connection due to administrator command`. The API must listen for pool-level errors so the Node process does not exit, and short-lived authentication-token inserts should retry transient connection failures.

**Why:** A deployment restart briefly terminated a pooled connection and surfaced as an Internal Server Error during token generation.

**How to apply:** Keep the pool error listener and transient retry boundary around authentication-token inserts; do not retry arbitrary database writes without an idempotency decision.