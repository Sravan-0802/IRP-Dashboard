---
name: Node 20 UI test runtime
description: Keep the browser-test DOM package compatible with the workspace Node 20 runtime.
---

In this workspace's Node 20 runtime, jsdom 30 selects Undici 8, which expects the zstd decompression API not provided by this runtime. Vitest workers then fail before test collection. jsdom 26 avoids that dependency path and works with Vitest.

**Why:** Installing the current jsdom release caused the test worker to crash before running tests, despite valid test code.

**How to apply:** When adding or upgrading Vitest's DOM environment, check Node compatibility first; keep jsdom on a compatible major if Undici expects unsupported Node APIs.
