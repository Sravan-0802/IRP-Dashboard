---
name: Drive tutorial playback
description: Native in-page playback requires bounded range delivery; full-file transfers and scaled Google embeds previously failed.
---

Keep Loom tutorial playback inside the website on both phones and desktops, without keeping a separate stored media copy.

**Why:** The user explicitly approved in-page mobile playback after rejecting oversized/cropped Google iframe controls and the workaround of opening a separate tab. Earlier production tests showed small byte ranges succeeded while full transfers of the approximately 80 MB video failed with HTTP 500. The exact infrastructure limit was not established.

**How to apply:** Use the native browser video player with bounded byte-range delivery from Drive. Never restore unbounded full-file proxy responses, scale Google's controls, or silently redirect phone playback into another tab. Retain a direct original-file fallback. Verify actual playback across chunks and seeking, not just the poster or a passing small-range request. Development mobile playback and seeking succeeded with bounded delivery; that does not by itself verify production.

