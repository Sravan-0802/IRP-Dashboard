---
name: Git mutation guard
description: Replit shell's safety gate for Git commands that modify repository metadata.
---

Git commands that write to `.git` may be refused unless prefixed with `DANGEROUSLY_ALLOW_GIT=1`.

**Why:** An authorized pull was blocked at `FETCH_HEAD` until the shell's explicit Git-write override was supplied.

**How to apply:** Use the override only after the user has authorized the Git operation. Inspect repository status before any history-changing command; read-only status and diff commands do not need the override.
