---
name: Drive tutorial playback
description: Why the Loom tutorial uses Google's embedded player instead of native video through the API.
---

Prefer Google Drive's preview iframe for the Loom tutorial, without duplicating the media into application storage.

**Why:** Production testing showed the approximately 80 MB tutorial succeeded for small byte ranges but failed with HTTP 500 for full transfers through the app proxy. The user asked about embedding without storage. The exact underlying transfer limit was not established.

**How to apply:** Keep a direct original-Drive-page fallback rather than linking to the same proxy. Track opening and closing only; do not invent playback progress for the cross-origin player.
