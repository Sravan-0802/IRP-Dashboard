---
name: Drive tutorial playback
description: Why the Loom tutorial uses Google's embedded player instead of native video through the API.
---

Use Google Drive's preview player for the Loom tutorial without duplicating the media into application storage; open it directly for narrow or short mobile screens.

**Why:** Production testing showed the approximately 80 MB tutorial succeeded for small byte ranges but failed with HTTP 500 for full transfers through the app proxy. The user asked about embedding without storage. Google's cross-origin iframe controls were also oversized/cropped on mobile, especially when scaled to fit the modal. The exact underlying transfer limit was not established.

**How to apply:** Keep an unscaled Drive preview iframe in the desktop modal. On narrow or short screens, open the Drive preview URL in a new tab so Drive owns its responsive player. Keep the original file page as the in-modal fallback. Track opening and closing only; do not invent playback progress for the cross-origin player.

