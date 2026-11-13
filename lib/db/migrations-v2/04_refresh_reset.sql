-- IRP data model v2 — refresh, part 1 of 2: empty the copied data so 02_copy.sql can refill it.
-- Runs in the SAME transaction as 02_copy.sql (see steps.mjs refresh() and the API's irpV2Refresh.ts),
-- so readers see either the old copy or the new one, never an empty table.
--
-- Kept on purpose: irp_v2.assessment_criteria (owned by the new model; the seed in 02_copy.sql skips
-- tags that already have a live row, so admin edits survive).
-- Never touches the old public.* tables.
--
-- Stop running this once the app WRITES to irp_v2 directly (expand–contract step 6), or those writes
-- would be wiped by the next refresh.
TRUNCATE
  irp_v2.users,
  irp_v2.mern_track_attempts,
  irp_v2.genai_track_attempts,
  irp_v2.mern_track,
  irp_v2.genai_track,
  irp_v2.login_tokens,
  irp_v2.admin_settings,
  irp_v2.student_groups,
  irp_v2.student_group_members,
  irp_v2.assessment_registrations,
  irp_v2.support_conversations,
  irp_v2.support_messages,
  irp_v2.activity_logs,
  irp_v2.sync_logs
RESTART IDENTITY;
