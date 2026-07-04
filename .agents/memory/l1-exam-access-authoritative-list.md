---
name: L1 exam-access authoritative slot list
description: Why the 5-July L1 exam links use an uploaded exam-platform list (l1_exam_access) instead of self-service registration slots.
---

For the 5-July L1 Hustler exam, the slot each student sees is driven by the
uploaded exam-platform list, stored in the `l1_exam_access` table (unique per
`academyUserId + cycle`, cycle default 2), NOT by the self-service slot
registration.

**Why:** the exam platform (topin.tech) is the real gate. Comparing the uploaded
list against DB registration showed large disagreement (hundreds of slot
conflicts, and hundreds of DB-registered students absent from the list). The
uploaded list is the source of truth for who actually has a seat and in which
slot, so registration slots cannot be trusted for building the exam links.

**How to apply:**
- Mock assessment link is COMMON to everyone on the list; the MAIN link is
  slot-specific (`L1_HUSTLER_MAIN_URLS[slotId]`) and must only appear on exam day
  (gate on `isAssessmentLive()` / EXAM_DATE, never on journey phase).
- When a student has exam access, treat their list slot as authoritative: hide
  slot selection/booking UI entirely, and keep the common mock link startable
  even if `deriveAssessmentState` would mark the mock "done" (a written cycle-1
  assessment must not suppress the new cycle-2 mock CTA).
- Slot end-times map to slot ids: ends 5:00 PM → slot-1 (3–5 PM IST), ends
  8:00 PM → slot-2 (6–8 PM IST).
- Populate the list via the admin-key route `POST /api/admin/l1-exam-access/import`
  (chunked upsert on `excluded.slot_id`). Dev DB is seeded directly by SQL; prod
  must be loaded by calling that deployed endpoint AFTER publish (dev/prod DBs are
  separate and prod SQL is read-only).
