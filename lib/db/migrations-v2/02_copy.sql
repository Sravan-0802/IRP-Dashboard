-- =============================================================================
-- IRP data model v2 — step 2: copy all data from public.* into irp_v2.*
-- run.mjs wraps this file in one transaction: everything lands or nothing does.
-- Old tables are only READ here.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------
INSERT INTO irp_v2.users (
  user_id, user_name, first_name, last_name, name_on_certificate, yog, lpoad,
  payment_status, payment_plan, irp_eligible_status, lp_status, product_status,
  profile_pic_url, record_source, synced_at, created_at, updated_at)
SELECT b.user_id, b.user_name, b.first_name, b.last_name, b.name_on_certificate, b.yog, b.lpoad,
       b.payment_status, b.payment_plan, b.irp_eligible_status, b.lp_status, b.product_status,
       b.profile_pic_url, 'BIGQUERY', b.synced_at, b.synced_at, b.synced_at
FROM public.academy_user_basic_details b;

-- Placeholder users for IDs that appear in other tables but not in BigQuery basic details
INSERT INTO irp_v2.users (user_id, record_source)
SELECT DISTINCT x.uid, 'NOT_IN_BIGQUERY'
FROM (
  SELECT user_id AS uid FROM public.academy_user_assessment_details
  UNION SELECT user_id FROM public.academy_user_nxtmock_details
  UNION SELECT user_id FROM public.academy_user_genai_assessment_details
  UNION SELECT user_id FROM public.academy_user_genai_nxtmock_details
  UNION SELECT candidate_id FROM public.human_interview_results
  UNION SELECT user_id FROM public.irp_l1_round_wise_summary
  UNION SELECT user_id FROM public.genai_project_submissions
  UNION SELECT academy_user_id FROM public.l1_cycle_registrations
  UNION SELECT academy_user_id FROM public.support_conversations
  UNION SELECT academy_user_id FROM public.contact_us_messages
  UNION SELECT academy_user_id FROM public.blocked_users
  UNION SELECT user_id FROM public.forms_auth_tokens WHERE expires_at > now()
  UNION SELECT split_part(email, '@', 1) FROM public.students WHERE email LIKE '%@academy.local'
) x
WHERE x.uid IS NOT NULL AND btrim(x.uid) <> ''
ON CONFLICT (user_id) DO NOTHING;

-- Fallback name, avatar and onboarding flag from the old students table
UPDATE irp_v2.users u
SET display_name         = s.name,
    avatar_url           = NULLIF(s.avatar, ''),
    onboarding_completed = (s.has_completed_onboarding <> 0),
    created_at           = LEAST(u.created_at, s.created_at)
FROM public.students s
WHERE split_part(s.email, '@', 1) = u.user_id;

-- Admin "Give dashboard access" panel grants (the only rows that bypass the 3 statuses)
UPDATE irp_v2.users u
SET access_override        = 'GRANTED',
    access_override_reason = 'Admin dashboard access panel (migrated)',
    access_override_by     = 'admin panel',
    access_override_at     = d.synced_at
FROM public.academy_user_assessment_details d
WHERE d.organisation_assessment_id = 'dashboard-access-override' AND d.user_id = u.user_id;

-- Blocked users win over any grant
UPDATE irp_v2.users u
SET access_override        = 'BLOCKED',
    access_override_reason = b.reason,
    access_override_by     = 'blocked_users (migrated)',
    access_override_at     = b.created_at
FROM public.blocked_users b
WHERE b.academy_user_id = u.user_id;

-- ---------------------------------------------------------------------------
-- 2. assessment_criteria — one live row per tag (today's effective values)
-- ---------------------------------------------------------------------------
INSERT INTO irp_v2.assessment_criteria
  (track, stage, assessment_specific_tag, criteria_type, qualifying_score_percentage, created_by, reason)
SELECT 'MERN', 'ASSESSMENT', 'ACADEMY-IRP-2.0_MAIN_L1_HUSTLER-ASSESSMENT_A' || n, 'PERCENTAGE', 70,
       'migration', 'L1 default rule: A1 onward 70%'
FROM generate_series(1, 10) AS n;

-- Old online cycle tags: the dashboard judges them exactly like Hustler sits (70%), not by the
-- old stored result, so they get the same criteria.
INSERT INTO irp_v2.assessment_criteria
  (track, stage, assessment_specific_tag, criteria_type, qualifying_score_percentage, created_by, reason)
VALUES
  ('MERN','ASSESSMENT','ACADEMY-IRP-2.0_MAIN_L1_ASSESSMENT_C1','PERCENTAGE',70,'migration','Old cycle tag: L1 rule 70%'),
  ('MERN','ASSESSMENT','ACADEMY-IRP-2.0_MAIN_L1_ASSESSMENT_C2','PERCENTAGE',70,'migration','Old cycle tag: L1 rule 70%');

INSERT INTO irp_v2.assessment_criteria
  (track, stage, assessment_specific_tag, criteria_type, qualifying_score_percentage, created_by, reason)
VALUES
  ('MERN','PROJECT','ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A1','PERCENTAGE', 70,'migration','FE rule A1'),
  ('MERN','PROJECT','ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A2','PERCENTAGE',100,'migration','FE rule A2'),
  ('MERN','PROJECT','ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A3','PERCENTAGE', 90,'migration','FE rule A3-A6'),
  ('MERN','PROJECT','ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A4','PERCENTAGE', 90,'migration','FE rule A3-A6'),
  ('MERN','PROJECT','ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A5','PERCENTAGE', 90,'migration','FE rule A3-A6'),
  ('MERN','PROJECT','ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A6','PERCENTAGE', 90,'migration','FE rule A3-A6'),
  ('MERN','PROJECT','ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A7','PERCENTAGE', 75,'migration','FE rule A7 onward'),
  ('MERN','PROJECT','ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A8','PERCENTAGE', 75,'migration','FE rule A7 onward'),
  ('MERN','PROJECT','ACADEMY-IRP-2.0_MAIN_L1_FE-Project_A9','PERCENTAGE', 75,'migration','FE rule A7 onward');

INSERT INTO irp_v2.assessment_criteria
  (track, stage, assessment_specific_tag, criteria_type, created_by, reason)
VALUES
  ('MERN','INTERVIEW',     'ACADEMY-IRP-2.0_MAIN_L1_HUMAN-INTERVIEW', 'EXTERNAL_RESULT','migration','Academy Nexus clearance_status'),
  ('MERN','PROJECT',      'ACADEMY-IRP-2.0_MAIN_L1_FE-Project_C1',   'EXTERNAL_RESULT','migration','Old cycle tag: keep BigQuery result'),
  ('MERN','PROJECT',       'ACADEMY-IRP-2.0_MAIN_L1_FE-PROJECT',      'EXTERNAL_RESULT','migration','Old cycle tag: keep BigQuery result'),
  ('MERN','MOCK_INTERVIEW','ACADEMY-IRP-2.0_MAIN_L1_NXTMOCK_C3',      'EXTERNAL_RESULT','migration','Old cycle tag: keep BigQuery result');

INSERT INTO irp_v2.assessment_criteria
  (track, stage, assessment_specific_tag, criteria_type,
   qualifying_theory_section_score, qualifying_coding_section_score, created_by, reason)
VALUES
  ('GENAI','ASSESSMENT','ACADEMY-GENAI-IRP-2.0_MAIN_ASSESSMENT_A1','SECTION_MARKS',20,48,'migration','GenAI rules saved 30 Oct 2026'),
  ('GENAI','ASSESSMENT','ACADEMY-GENAI-IRP-2.0_MAIN_ASSESSMENT_A2','SECTION_MARKS',20,48,'migration','GenAI rules saved 30 Oct 2026'),
  ('GENAI','ASSESSMENT','ACADEMY-GENAI-IRP-2.0_MAIN_ASSESSMENT_A3','SECTION_MARKS',25,48,'migration','GenAI rules saved 30 Oct 2026'),
  ('GENAI','ASSESSMENT','ACADEMY-GENAI-IRP-2.0_MAIN_ASSESSMENT_A4','SECTION_MARKS',25,48,'migration','GenAI rules saved 30 Oct 2026');

-- ---------------------------------------------------------------------------
-- 3. mern_track_attempts
-- ---------------------------------------------------------------------------
-- 3a. Assessment + FE + old NxtMock rows from academy_user_assessment_details
--     (access-flag rows are excluded; they are handled in users / student_groups)
INSERT INTO irp_v2.mern_track_attempts (
  user_id, stage, source_system, organisation_assessment_id, assessment_specific_tag,
  assessment_title, assessment_type, assessment_level, assessment_number, cycle, attempt_number,
  assessment_start_datetime, assessment_end_datetime, user_assessment_start_datetime,
  assessment_actual_score, user_assessment_score, user_assessment_score_percentage,
  theory_section_actual_score, theory_section_score, theory_section_score_percentage,
  coding_section_actual_score, coding_section_score, coding_section_score_percentage,
  section_details, assessment_status, synced_at)
SELECT
  d.user_id,
  CASE
    WHEN d.assessment_tag ILIKE '%FE-PROJECT%' OR d.level ILIKE '%FE-PROJECT%'
      OR d.assessment_title ILIKE '%FE PROJECT%' OR d.assessment_title ILIKE '%FE-PROJECT%' THEN 'PROJECT'
    WHEN d.assessment_tag ILIKE '%NXTMOCK%'    OR d.level ILIKE '%NXTMOCK%'    THEN 'MOCK_INTERVIEW'
    ELSE 'ASSESSMENT'
  END,
  'BIGQUERY',
  d.organisation_assessment_id,
  -- An older sync stored only the assessment number ('A4') as the tag. Rebuild the
  -- BigQuery assessment_specific_tag: kind + number (confirmed against the z_* tables).
  CASE
    WHEN d.assessment_tag ~ '^A[0-9]+$' AND d.assessment_title ILIKE '%FE Project%'
      THEN 'ACADEMY-IRP-2.0_MAIN_L1_FE-Project_' || d.assessment_tag
    WHEN d.assessment_tag ~ '^A[0-9]+$' AND d.assessment_title ILIKE '%Hustler Assessment%'
      THEN 'ACADEMY-IRP-2.0_MAIN_L1_HUSTLER-ASSESSMENT_' || d.assessment_tag
    ELSE d.assessment_tag
  END,
  d.assessment_title,
  CASE WHEN d.assessment_tag ~* '(^|_)MOCK(_|$)' OR d.assessment_title ~* '\mMOCK\M' THEN 'MOCK' ELSE 'MAIN' END,
  d.level,
  substring(d.assessment_tag from '(?:^|_)([AC][0-9]+)$'),
  d.cycle,
  COALESCE(d.attempt_number, 1),
  d.assessment_start_datetime,
  d.assessment_end_datetime,
  d.user_assessment_start_datetime,
  d.assessment_total_score,
  d.assessment_user_score,
  -- Same fallback as the API today: overall score, else the sum of the section scores.
  CASE WHEN COALESCE(d.assessment_total_score,
                     NULLIF(COALESCE(d.mcq_section_max_score, 0) + COALESCE(d.coding_section_max_score, 0)
                            + COALESCE(d.fe_section_max_score, 0), 0)) > 0
       THEN COALESCE(d.assessment_user_score,
                     NULLIF(COALESCE(d.mcq_user_section_score, 0) + COALESCE(d.coding_user_section_score, 0)
                            + COALESCE(d.fe_user_section_score, 0), 0))::float8
            / COALESCE(d.assessment_total_score,
                       NULLIF(COALESCE(d.mcq_section_max_score, 0) + COALESCE(d.coding_section_max_score, 0)
                              + COALESCE(d.fe_section_max_score, 0), 0))::float8 * 100 END,
  d.mcq_section_max_score,
  d.mcq_user_section_score,
  CASE WHEN d.mcq_section_max_score > 0
       THEN (d.mcq_user_section_score::float8 / d.mcq_section_max_score::float8 * 100) END,
  d.coding_section_max_score,
  d.coding_user_section_score,
  CASE WHEN d.coding_section_max_score > 0
       THEN (d.coding_user_section_score::float8 / d.coding_section_max_score::float8 * 100) END,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_table',                   'academy_user_assessment_details',
    'legacy_id',                      d.id,
    'legacy_assessment_tag',          d.assessment_tag,
    'source_attempt_number',          d.attempt_number,
    'mcq_attempt_duration_mins',      d.mcq_attempt_duration_mins,
    'coding_attempt_duration_mins',   d.coding_attempt_duration_mins,
    'fe_section_max_score',           d.fe_section_max_score,
    'fe_user_section_score',          d.fe_user_section_score,
    'fe_attempt_duration_mins',       d.fe_attempt_duration_mins,
    'previous_qualification_status',  d.qualification_status)),
  d.assessment_status,
  d.synced_at
FROM public.academy_user_assessment_details d
WHERE d.organisation_assessment_id NOT IN ('manual-access-grant','manual-access-revoke','dashboard-access-override');

-- 3b. Old NxtMock (AI mock) interviews
INSERT INTO irp_v2.mern_track_attempts (
  user_id, stage, source_system, organisation_assessment_id, assessment_title, assessment_type,
  assessment_level, cycle, attempt_number, user_assessment_score, section_wise_rating_json,
  section_details, assessment_status, synced_at)
SELECT
  n.user_id, 'MOCK_INTERVIEW', 'BIGQUERY', n.interview_id, n.interview_title, n.exam_type,
  n.level, n.cycle, COALESCE(n.attempt_number, 1), n.average_rating,
  jsonb_strip_nulls(jsonb_build_object(
    'self_intro_rating',        n.self_intro_rating,
    'javascript_coding_rating', n.javascript_coding_rating,
    'javascript_rating',        n.javascript_rating,
    'css_rating',               n.css_rating,
    'html_rating',              n.html_rating,
    'react_js_rating',          n.react_js_rating)),
  jsonb_build_object('legacy_table', 'academy_user_nxtmock_details', 'legacy_id', n.id),
  n.interview_status, n.synced_at
FROM public.academy_user_nxtmock_details n;

-- 3c. Human interviews (Academy Nexus); one row per interview
INSERT INTO irp_v2.mern_track_attempts (
  user_id, stage, source_system, organisation_assessment_id, assessment_specific_tag, assessment_title,
  assessment_type, attempt_number, user_assessment_start_datetime, user_assessment_score,
  section_wise_rating_json, section_details, assessment_status, synced_at)
SELECT
  h.candidate_id, 'INTERVIEW', 'NEXUS', h.interview_id, 'ACADEMY-IRP-2.0_MAIN_L1_HUMAN-INTERVIEW',
  'IRP L1 Human Interview', 'MAIN',
  row_number() OVER (PARTITION BY h.candidate_id ORDER BY h.interview_starts_at NULLS LAST, h.interview_id),
  h.interview_starts_at, h.final_score,
  jsonb_strip_nulls(jsonb_build_object(
    'part1_avg', h.part1_avg, 'part2_avg', h.part2_avg, 'part3_avg', h.part3_avg,
    'communication_rating', h.communication_rating)),
  jsonb_build_object('legacy_table', 'human_interview_results',
                     'interview_date', h.interview_date, 'interview_start_time', h.interview_start_time),
  h.clearance_status, h.synced_at
FROM public.human_interview_results h;

-- 3d. Round-wise summary fallback: students the dashboard shows as Online Assessment
--     QUALIFIED only through the BigQuery summary (no written Hustler detail row).
INSERT INTO irp_v2.mern_track_attempts (
  user_id, stage, source_system, organisation_assessment_id, assessment_specific_tag, assessment_title,
  assessment_type, assessment_number, attempt_number, user_assessment_start_datetime,
  user_assessment_score_percentage, theory_section_score, theory_section_score_percentage,
  coding_section_score, coding_section_score_percentage, section_details, assessment_status, synced_at)
SELECT
  r.user_id, 'ASSESSMENT', 'BIGQUERY_SUMMARY', 'round-wise:hustler',
  CASE WHEN btrim(r.hustler_assessment_number) ~ '^A[0-9]+$'
       THEN 'ACADEMY-IRP-2.0_MAIN_L1_HUSTLER-ASSESSMENT_' || btrim(r.hustler_assessment_number) END,
  'IRP L1 Hustler Assessment (round-wise summary)', 'MAIN',
  btrim(r.hustler_assessment_number), COALESCE(r.hustler_assessment_attempt_number, 1),
  r.hustler_assessment_attempt_date,
  r.hustler_assessment_score_percentage,
  r.hustler_assessment_theory_section_score, r.hustler_assessment_theory_section_score_percentage,
  r.hustler_assessment_coding_section_score, r.hustler_assessment_coding_section_score_percentage,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_table', 'irp_l1_round_wise_summary',
    'theory_section_attempt_status', r.hustler_assessment_theory_section_attempt_status,
    'coding_section_attempt_status', r.hustler_assessment_coding_section_attempt_status)),
  r.hustler_assessment_status, r.synced_at
FROM public.irp_l1_round_wise_summary r
WHERE r.hustler_assessment_status ILIKE 'QUALIFIED'
  AND NOT EXISTS (
    SELECT 1 FROM public.academy_user_assessment_details d
    WHERE d.user_id = r.user_id
      AND (d.assessment_tag ILIKE '%HUSTLER%' OR d.assessment_title ILIKE '%Hustler Assessment%')
      AND d.user_assessment_start_datetime IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 4. genai_track_attempts
-- ---------------------------------------------------------------------------
INSERT INTO irp_v2.genai_track_attempts (
  user_id, stage, source_system, organisation_assessment_id, assessment_specific_tag, assessment_title,
  assessment_type, assessment_number, attempt_number, assessment_start_datetime,
  user_assessment_start_datetime, assessment_actual_score, user_assessment_score,
  user_assessment_score_percentage, theory_section_actual_score, theory_section_score,
  theory_section_score_percentage, coding_section_actual_score, coding_section_score,
  coding_section_score_percentage, section_details, assessment_status, synced_at)
SELECT
  g.user_id, 'ASSESSMENT', 'BIGQUERY', g.organisation_assessment_id, g.assessment_tag, g.assessment_title,
  g.assessment_type, g.assessment_number, COALESCE(g.attempt_number, 1), g.assessment_start_datetime,
  g.user_assessment_start_datetime, g.total_max, g.total_score,
  CASE WHEN g.total_max > 0 THEN (g.total_score::float8 / g.total_max::float8 * 100) END,
  g.mcq_max, g.mcq_score,
  CASE WHEN g.mcq_max > 0 THEN (g.mcq_score::float8 / g.mcq_max::float8 * 100) END,
  g.coding_max, g.coding_score,
  CASE WHEN g.coding_max > 0 THEN (g.coding_score::float8 / g.coding_max::float8 * 100) END,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_table', 'academy_user_genai_assessment_details', 'legacy_id', g.id,
    'attempted', g.attempted, 'previous_qualification_status', g.qualification_status)),
  NULL, g.synced_at
FROM public.academy_user_genai_assessment_details g;

INSERT INTO irp_v2.genai_track_attempts (
  user_id, stage, source_system, organisation_assessment_id, assessment_specific_tag, assessment_type,
  assessment_number, attempt_number, user_assessment_start_datetime, user_assessment_score,
  section_wise_rating_json, section_details, assessment_status, synced_at)
SELECT
  n.user_id, 'MOCK_INTERVIEW', 'BIGQUERY', n.interview_id, n.interview_tag, n.interview_type,
  n.interview_number, COALESCE(n.attempt_number, 1), n.attempt_start_datetime, n.overall_rating,
  irp_v2.try_jsonb(n.section_ratings),
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_table', 'academy_user_genai_nxtmock_details', 'legacy_id', n.id,
    'average_rating', n.average_rating)),
  n.attempt_status, n.synced_at
FROM public.academy_user_genai_nxtmock_details n;

-- ---------------------------------------------------------------------------
-- 5. Judge every attempt (qualification_status)
-- ---------------------------------------------------------------------------
-- 5a. Interviews, mock interviews and MOCK sits: use the source's own result
UPDATE irp_v2.mern_track_attempts
SET qualification_status = irp_v2.map_status(assessment_status), evaluated_at = now()
WHERE stage IN ('INTERVIEW','MOCK_INTERVIEW') OR assessment_type = 'MOCK';

UPDATE irp_v2.genai_track_attempts
SET qualification_status = CASE WHEN stage = 'MOCK_INTERVIEW' AND upper(COALESCE(assessment_status,'')) <> 'COMPLETED'
                                THEN 'NOT_ATTEMPTED'
                                ELSE irp_v2.map_status(assessment_status) END,
    evaluated_at = now()
WHERE stage IN ('INTERVIEW','MOCK_INTERVIEW') OR assessment_type = 'MOCK';

-- 5b-1. PERCENTAGE criteria, Online Assessment MAIN sits — same rules as the dashboard today
--       (isValidL1OnlineDetailSit + isAssessmentSitCleared):
--   * a sit counts as taken when it has any score, an attempt number or a BigQuery result,
--     AND real max marks (theory or coding max > 0, or overall max >= 100); otherwise NOT_ATTEMPTED;
--   * BigQuery's own QUALIFIED / NOT QUALIFIED wins;
--   * otherwise QUALIFIED when the rounded percentage >= pass mark.
UPDATE irp_v2.mern_track_attempts a
SET criteria_id                 = c.criteria_id,
    qualifying_score_percentage = c.qualifying_score_percentage,
    qualification_status = CASE
      WHEN NOT (a.user_assessment_score IS NOT NULL OR a.theory_section_score IS NOT NULL
                OR a.coding_section_score IS NOT NULL OR a.section_details ? 'fe_user_section_score'
                OR a.section_details ? 'source_attempt_number'
                OR COALESCE(a.assessment_status, '') ~* 'qualified')
        OR NOT (COALESCE(a.theory_section_actual_score, 0) > 0 OR COALESCE(a.coding_section_actual_score, 0) > 0
                OR COALESCE(a.assessment_actual_score,
                            COALESCE(a.theory_section_actual_score, 0) + COALESCE(a.coding_section_actual_score, 0)
                            + COALESCE((a.section_details->>'fe_section_max_score')::float8, 0)) >= 100)
        THEN 'NOT_ATTEMPTED'
      WHEN btrim(COALESCE(a.assessment_status, '')) ~* 'not\s*qualified' THEN 'NOT_QUALIFIED'
      WHEN btrim(COALESCE(a.assessment_status, '')) ~* 'qualified'       THEN 'QUALIFIED'
      WHEN a.user_assessment_score_percentage IS NOT NULL
           AND floor(a.user_assessment_score_percentage + 0.5) >= c.qualifying_score_percentage THEN 'QUALIFIED'
      ELSE 'NOT_QUALIFIED' END,
    evaluated_at = now()
FROM irp_v2.assessment_criteria c
WHERE c.assessment_specific_tag = a.assessment_specific_tag
  AND c.valid_until IS NULL
  AND c.criteria_type = 'PERCENTAGE'
  AND a.assessment_type = 'MAIN'
  AND a.stage = 'ASSESSMENT';

-- 5b-2. PERCENTAGE criteria, FE Project MAIN sits — same logic as the API today:
--     QUALIFIED when % >= pass mark; else NOT_QUALIFIED if the student started; else NOT_ATTEMPTED.
UPDATE irp_v2.mern_track_attempts a
SET criteria_id                 = c.criteria_id,
    qualifying_score_percentage = c.qualifying_score_percentage,
    qualification_status = CASE
      WHEN a.user_assessment_score_percentage IS NOT NULL
           AND a.user_assessment_score_percentage >= c.qualifying_score_percentage THEN 'QUALIFIED'
      WHEN a.user_assessment_start_datetime IS NOT NULL THEN 'NOT_QUALIFIED'
      ELSE 'NOT_ATTEMPTED' END,
    evaluated_at = now()
FROM irp_v2.assessment_criteria c
WHERE c.assessment_specific_tag = a.assessment_specific_tag
  AND c.valid_until IS NULL
  AND c.criteria_type = 'PERCENTAGE'
  AND a.assessment_type = 'MAIN'
  AND a.stage = 'PROJECT';

-- 5c. EXTERNAL_RESULT criteria (Human interview tag + 5 old cycle tags)
UPDATE irp_v2.mern_track_attempts a
SET criteria_id = c.criteria_id,
    -- Old-cycle rows keep their result in the old qualification_status column, not assessment_status.
    qualification_status = irp_v2.map_status(COALESCE(a.assessment_status,
                                                      a.section_details->>'previous_qualification_status')),
    evaluated_at = now()
FROM irp_v2.assessment_criteria c
WHERE c.assessment_specific_tag = a.assessment_specific_tag
  AND c.valid_until IS NULL
  AND c.criteria_type = 'EXTERNAL_RESULT';

-- 5d. SECTION_MARKS criteria (GenAI) — same logic as genaiResults.ts today
UPDATE irp_v2.genai_track_attempts a
SET criteria_id                     = c.criteria_id,
    qualifying_theory_section_score = c.qualifying_theory_section_score,
    qualifying_coding_section_score = c.qualifying_coding_section_score,
    qualification_status = CASE
      WHEN COALESCE((a.section_details->>'attempted')::int, 0) <> 1 THEN 'NOT_ATTEMPTED'
      WHEN a.theory_section_score IS NULL AND a.coding_section_score IS NULL THEN 'RESULT_PENDING'
      WHEN COALESCE(a.theory_section_score, 0) >= c.qualifying_theory_section_score
       AND COALESCE(a.coding_section_score, 0) >= c.qualifying_coding_section_score THEN 'QUALIFIED'
      ELSE 'NOT_QUALIFIED' END,
    evaluated_at = now()
FROM irp_v2.assessment_criteria c
WHERE c.assessment_specific_tag = a.assessment_specific_tag
  AND c.valid_until IS NULL
  AND c.criteria_type = 'SECTION_MARKS'
  AND a.stage = 'ASSESSMENT';

-- GenAI sits that were never attempted (with or without criteria)
UPDATE irp_v2.genai_track_attempts
SET qualification_status = 'NOT_ATTEMPTED', evaluated_at = COALESCE(evaluated_at, now())
WHERE stage = 'ASSESSMENT' AND criteria_id IS NULL
  AND COALESCE((section_details->>'attempted')::int, 0) <> 1;

-- 5e. MERN sits whose tag has no criteria yet: not started → NOT_ATTEMPTED,
--     started → stays RESULT_PENDING until someone sets criteria for that tag.
UPDATE irp_v2.mern_track_attempts
SET qualification_status = 'NOT_ATTEMPTED', evaluated_at = now()
WHERE evaluated_at IS NULL AND user_assessment_start_datetime IS NULL;

-- ---------------------------------------------------------------------------
-- 6. mern_track — one row per user, built from the attempts
-- ---------------------------------------------------------------------------
INSERT INTO irp_v2.mern_track (
  user_id, journey_state, is_wildcard, has_attempted_level1, level3_exam_started,
  reattempt_date, project_submitted, project_due_date, calculated_at)
SELECT u.user_id,
       COALESCE(s.journey_state, 'L1_PREP'),
       COALESCE(s.is_wildcard, 0) <> 0,
       COALESCE(s.has_attempted_l1, 0) <> 0,
       COALESCE(s.l3_exam_started, 0) <> 0,
       s.reattempt_date,
       COALESCE(s.project_submitted, 0) <> 0,
       s.project_due_date,
       now()
FROM irp_v2.users u
LEFT JOIN public.students s ON split_part(s.email, '@', 1) = u.user_id;

-- 6a. Online Assessment (Hustler): any QUALIFIED MAIN sit wins, else the latest written sit
UPDATE irp_v2.mern_track t
SET hustler_assessment_status = CASE b.qualification_status
        WHEN 'QUALIFIED' THEN 'QUALIFIED' WHEN 'NOT_QUALIFIED' THEN 'NOT_QUALIFIED' ELSE 'RESULT_PENDING' END,
    hustler_assessment_specific_tag                = b.assessment_specific_tag,
    hustler_assessment_number                      = b.assessment_number,
    hustler_assessment_attempt_number              = b.attempt_number,
    hustler_assessment_attempt_date                = b.user_assessment_start_datetime,
    hustler_assessment_score_percentage            = b.user_assessment_score_percentage,
    hustler_assessment_theory_section_score        = b.theory_section_score,
    hustler_assessment_coding_section_score        = b.coding_section_score,
    hustler_assessment_qualifying_score_percentage = b.qualifying_score_percentage,
    hustler_assessment_total_attempts              = b.total_attempts,
    hustler_assessment_best_attempt_id             = b.attempt_id
FROM (
  -- total_attempts counts distinct assessments: the same sit can exist twice
  -- (once from the portal view, once from the z_* table) under different ids.
  SELECT DISTINCT ON (a.user_id) a.*,
         (SELECT count(DISTINCT COALESCE(x.assessment_specific_tag, x.organisation_assessment_id))
          FROM irp_v2.mern_track_attempts x
          WHERE x.user_id = a.user_id AND x.stage = 'ASSESSMENT' AND x.assessment_type = 'MAIN'
            AND x.qualification_status <> 'NOT_ATTEMPTED') AS total_attempts
  FROM irp_v2.mern_track_attempts a
  WHERE a.stage = 'ASSESSMENT' AND a.assessment_type = 'MAIN' AND a.qualification_status <> 'NOT_ATTEMPTED'
  ORDER BY a.user_id, (a.qualification_status = 'QUALIFIED') DESC,
           a.user_assessment_start_datetime DESC NULLS LAST, a.user_assessment_score_percentage DESC NULLS LAST,
           (a.source_system = 'BIGQUERY') DESC, a.attempt_id
) b
WHERE t.user_id = b.user_id;

-- 6b. FE Project
UPDATE irp_v2.mern_track t
SET fe_project_status = CASE b.qualification_status
        WHEN 'QUALIFIED' THEN 'QUALIFIED' WHEN 'NOT_QUALIFIED' THEN 'NOT_QUALIFIED' ELSE 'RESULT_PENDING' END,
    fe_project_specific_tag                = b.assessment_specific_tag,
    fe_project_assessment_number           = b.assessment_number,
    fe_project_attempt_number              = b.attempt_number,
    fe_project_attempt_date                = b.user_assessment_start_datetime,
    fe_project_score_percentage            = b.user_assessment_score_percentage,
    fe_project_qualifying_score_percentage = b.qualifying_score_percentage,
    fe_project_total_attempts              = b.total_attempts,
    fe_project_best_attempt_id             = b.attempt_id
FROM (
  SELECT DISTINCT ON (a.user_id) a.*,
         (SELECT count(DISTINCT COALESCE(x.assessment_specific_tag, x.organisation_assessment_id))
          FROM irp_v2.mern_track_attempts x
          WHERE x.user_id = a.user_id AND x.stage = 'PROJECT' AND x.assessment_type = 'MAIN'
            AND x.qualification_status <> 'NOT_ATTEMPTED') AS total_attempts
  FROM irp_v2.mern_track_attempts a
  WHERE a.stage = 'PROJECT' AND a.assessment_type = 'MAIN' AND a.qualification_status <> 'NOT_ATTEMPTED'
  ORDER BY a.user_id, (a.qualification_status = 'QUALIFIED') DESC,
           a.user_assessment_start_datetime DESC NULLS LAST, a.user_assessment_score_percentage DESC NULLS LAST,
           (a.source_system = 'BIGQUERY') DESC, a.attempt_id
) b
WHERE t.user_id = b.user_id;

UPDATE irp_v2.mern_track
SET fe_project_status = 'ACTIVE'
WHERE fe_project_status = 'NOT_ATTEMPTED' AND hustler_assessment_status = 'QUALIFIED';

-- 6c. Human Interview: the newest interview with a final score and a final Cleared / Not Cleared
--     result decides (same as the dashboard today). No-show, declined and partly done interviews
--     are kept as attempts but never decide the stage.
UPDATE irp_v2.mern_track t
SET human_interview_status = CASE b.qualification_status
        WHEN 'QUALIFIED' THEN 'QUALIFIED' WHEN 'NOT_QUALIFIED' THEN 'NOT_QUALIFIED' ELSE 'NOT_ATTEMPTED' END,
    human_interview_score           = b.user_assessment_score,
    human_interview_attempt_number  = b.attempt_number,
    human_interview_attempt_date    = b.user_assessment_start_datetime,
    human_interview_total_attempts  = b.total_attempts,
    human_interview_best_attempt_id = b.attempt_id
FROM (
  SELECT DISTINCT ON (a.user_id) a.*,
         (SELECT count(*) FROM irp_v2.mern_track_attempts x
          WHERE x.user_id = a.user_id AND x.stage = 'INTERVIEW') AS total_attempts
  FROM irp_v2.mern_track_attempts a
  WHERE a.stage = 'INTERVIEW'
    AND a.user_assessment_score IS NOT NULL
    AND a.assessment_status IN ('Cleared', 'Not Cleared')
  ORDER BY a.user_id, a.user_assessment_start_datetime DESC NULLS LAST, a.organisation_assessment_id
) b
WHERE t.user_id = b.user_id;

UPDATE irp_v2.mern_track
SET human_interview_status = 'ACTIVE'
WHERE human_interview_status = 'NOT_ATTEMPTED'
  AND (fe_project_status = 'QUALIFIED' OR journey_state = 'L1_HUMAN_INTERVIEW');

-- 6d. AI Mock (latest MAIN mock interview, reference only)
UPDATE irp_v2.mern_track t
SET nxtmock_status           = b.assessment_status,
    nxtmock_interview_rating = b.user_assessment_score,
    nxtmock_interview_number = COALESCE(b.assessment_number, b.cycle),
    nxtmock_attempt_number   = b.attempt_number,
    nxtmock_attempt_date     = b.user_assessment_start_datetime
FROM (
  SELECT DISTINCT ON (a.user_id) a.*
  FROM irp_v2.mern_track_attempts a
  WHERE a.stage = 'MOCK_INTERVIEW' AND upper(COALESCE(a.assessment_type, 'MAIN')) = 'MAIN'
  ORDER BY a.user_id, a.user_assessment_start_datetime DESC NULLS LAST, a.attempt_number DESC
) b
WHERE t.user_id = b.user_id;

-- 6e. Level 2
UPDATE irp_v2.mern_track
SET level2_status = CASE
  WHEN journey_state = 'PLACED' THEN 'QUALIFIED'
  WHEN journey_state ~ '^L[23]_' THEN 'ACTIVE'
  ELSE 'NOT_ATTEMPTED' END;

-- ---------------------------------------------------------------------------
-- 7. genai_track — one row per user
-- ---------------------------------------------------------------------------
INSERT INTO irp_v2.genai_track (user_id, calculated_at)
SELECT user_id, now() FROM irp_v2.users;

UPDATE irp_v2.genai_track t
SET genai_assessment_status = CASE b.qualification_status
        WHEN 'QUALIFIED' THEN 'QUALIFIED' WHEN 'NOT_QUALIFIED' THEN 'NOT_QUALIFIED' ELSE 'RESULT_PENDING' END,
    genai_assessment_specific_tag                    = b.assessment_specific_tag,
    genai_assessment_number                          = b.assessment_number,
    genai_assessment_attempt_number                  = b.attempt_number,
    genai_assessment_attempt_date                    = b.user_assessment_start_datetime,
    genai_assessment_score_percentage                = b.user_assessment_score_percentage,
    genai_assessment_theory_section_score            = b.theory_section_score,
    genai_assessment_coding_section_score            = b.coding_section_score,
    genai_assessment_qualifying_theory_section_score = b.qualifying_theory_section_score,
    genai_assessment_qualifying_coding_section_score = b.qualifying_coding_section_score,
    genai_assessment_total_attempts                  = b.total_attempts,
    genai_assessment_best_attempt_id                 = b.attempt_id
FROM (
  SELECT DISTINCT ON (a.user_id) a.*,
         count(*) OVER (PARTITION BY a.user_id) AS total_attempts
  FROM irp_v2.genai_track_attempts a
  WHERE a.stage = 'ASSESSMENT' AND a.qualification_status <> 'NOT_ATTEMPTED'
  ORDER BY a.user_id, (a.qualification_status = 'QUALIFIED') DESC,
           a.user_assessment_start_datetime DESC NULLS LAST
) b
WHERE t.user_id = b.user_id;

-- Project + Loom from the old one-row-per-user submission
UPDATE irp_v2.genai_track t
SET genai_selected_projects  = COALESCE(s.selected_projects, '{}'),
    genai_project_title      = s.project_title,
    genai_video_url          = NULLIF(s.loom_url, ''),
    genai_video_submitted_at = s.created_at,
    genai_video_updated_at   = s.updated_at
FROM public.genai_project_submissions s
WHERE s.user_id = t.user_id;

UPDATE irp_v2.genai_track
SET genai_project_status = CASE
      WHEN cardinality(genai_selected_projects) >= 2 OR genai_video_url IS NOT NULL THEN 'QUALIFIED'
      WHEN genai_assessment_status = 'QUALIFIED' THEN 'ACTIVE'
      ELSE 'NOT_ATTEMPTED' END,
    genai_video_status = CASE
      WHEN genai_video_url IS NOT NULL THEN 'QUALIFIED'
      WHEN genai_assessment_status = 'QUALIFIED' THEN 'ACTIVE'
      ELSE 'NOT_ATTEMPTED' END;

UPDATE irp_v2.genai_track t
SET genai_nxtmock_status           = b.assessment_status,
    genai_nxtmock_interview_rating = b.user_assessment_score,
    genai_nxtmock_attempt_date     = b.user_assessment_start_datetime
FROM (
  SELECT DISTINCT ON (a.user_id) a.*
  FROM irp_v2.genai_track_attempts a
  WHERE a.stage = 'MOCK_INTERVIEW'
  ORDER BY a.user_id, a.user_assessment_start_datetime DESC NULLS LAST, a.attempt_number DESC
) b
WHERE t.user_id = b.user_id;

-- ---------------------------------------------------------------------------
-- 8. login_tokens — only tokens that are still valid; stored as sha256 hashes
-- ---------------------------------------------------------------------------
INSERT INTO irp_v2.login_tokens (token_hash, user_id, expires_at, created_at)
SELECT encode(sha256(convert_to(t.token, 'UTF8')), 'hex'), t.user_id, t.expires_at, t.created_at
FROM public.forms_auth_tokens t
WHERE t.expires_at > now()
ON CONFLICT (token_hash) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. admin_settings
-- ---------------------------------------------------------------------------
INSERT INTO irp_v2.admin_settings (setting_key, setting_value, updated_by, updated_at)
SELECT 'visibility.' || v.key,
       jsonb_build_object('visible', v.visible <> 0, 'release_at', v.release_at),
       'migration', v.updated_at
FROM public.visibility_settings v;

INSERT INTO irp_v2.admin_settings (setting_key, setting_value, updated_by, updated_at)
SELECT 'genai_training_popup', to_jsonb(p) - 'id' - 'updated_at', 'migration', p.updated_at
FROM public.genai_training_popup p;

INSERT INTO irp_v2.admin_settings (setting_key, setting_value, updated_by, updated_at)
SELECT 'program_board', irp_v2.try_jsonb(b.payload), 'migration', b.updated_at
FROM public.program_board b;

INSERT INTO irp_v2.admin_settings (setting_key, setting_value, updated_by, updated_at)
SELECT 'legacy.fe_qualification_rules', irp_v2.try_jsonb(payload), 'migration', updated_at FROM public.fe_qualification_rules
UNION ALL
SELECT 'legacy.l1_qualification_rules', irp_v2.try_jsonb(payload), 'migration', updated_at FROM public.l1_qualification_rules
UNION ALL
SELECT 'legacy.genai_qualification_rules', irp_v2.try_jsonb(payload), 'migration', updated_at FROM public.genai_qualification_rules;

-- ---------------------------------------------------------------------------
-- 10. student_groups + student_group_members
-- ---------------------------------------------------------------------------
-- Access-link batches
INSERT INTO irp_v2.student_groups (
  group_type, track, stage, group_name, link_type, link_url, is_enabled, starts_at, expires_at,
  extra_details, created_by, created_at, updated_at)
SELECT 'ACCESS_GRANT', CASE WHEN a.stage ILIKE 'genai%' THEN 'GENAI' ELSE 'MERN' END,
       a.stage, a.name, a.link_kind, a.url, a.enabled <> 0, a.starts_at, a.expires_at,
       jsonb_build_object('legacy_table', 'access_batches', 'legacy_id', a.id),
       a.created_by, a.created_at, a.updated_at
FROM public.access_batches a;

INSERT INTO irp_v2.student_group_members (group_id, user_id, created_at)
SELECT g.group_id, m.academy_user_id, m.created_at
FROM public.access_batch_users m
JOIN irp_v2.student_groups g
  ON g.extra_details->>'legacy_table' = 'access_batches' AND (g.extra_details->>'legacy_id')::int = m.batch_id;

-- Registration batches
INSERT INTO irp_v2.student_groups (
  group_type, track, group_name, assessment_name, assessment_date_label, assessment_date, slot_id,
  slot_name, is_enabled, starts_at, expires_at, extra_details, created_by, created_at, updated_at)
SELECT 'REGISTRATION', 'MERN', r.name, r.assessment_label, r.assessment_date,
       COALESCE(irp_v2.label_to_date(r.assessment_date),
         -- one label lost its day number; the fortnightly Sunday between 23 Aug and 20 Sep is 6 Sep
         CASE WHEN btrim(r.assessment_date) = '^th September 2026' THEN DATE '2026-09-06' END), r.slot_id, r.slot_label, r.enabled <> 0,
       r.starts_at, r.expires_at,
       jsonb_build_object('legacy_table', 'registration_batches', 'legacy_id', r.id),
       r.created_by, r.created_at, r.updated_at
FROM public.registration_batches r;

INSERT INTO irp_v2.student_group_members (group_id, user_id, created_at)
SELECT g.group_id, m.academy_user_id, m.created_at
FROM public.registration_batch_users m
JOIN irp_v2.student_groups g
  ON g.extra_details->>'legacy_table' = 'registration_batches' AND (g.extra_details->>'legacy_id')::int = m.batch_id;

-- Exam-platform slot access (one group per cycle + slot)
INSERT INTO irp_v2.student_groups (group_type, track, stage, group_name, cycle, slot_id, extra_details, created_by)
SELECT DISTINCT 'EXAM_ACCESS', 'MERN', 'ASSESSMENT', 'Exam access cycle ' || e.cycle || ' slot ' || e.slot_id,
       e.cycle, e.slot_id, jsonb_build_object('legacy_table', 'l1_exam_access'), 'migration'
FROM public.l1_exam_access e;

INSERT INTO irp_v2.student_group_members (group_id, user_id, created_at)
SELECT g.group_id, e.academy_user_id, e.created_at
FROM public.l1_exam_access e
JOIN irp_v2.student_groups g
  ON g.group_type = 'EXAM_ACCESS' AND g.cycle = e.cycle AND g.slot_id = e.slot_id;

-- Unpaid users (kept for history; no longer gates the dashboard)
INSERT INTO irp_v2.student_groups (group_type, group_name, is_enabled, extra_details, created_by)
VALUES ('UNPAID', 'Unpaid users (imported list)', false,
        jsonb_build_object('legacy_table', 'unpaid_users'), 'migration');

INSERT INTO irp_v2.student_group_members (group_id, user_id, created_at)
SELECT g.group_id, u.academy_user_id, u.created_at
FROM public.unpaid_users u
JOIN irp_v2.student_groups g ON g.group_type = 'UNPAID';

-- Legacy bulk access grant / revoke rows (inactive; kept for history)
INSERT INTO irp_v2.student_groups (group_type, group_name, is_enabled, extra_details, created_by)
VALUES
  ('LEGACY_ACCESS_GRANT',  'Legacy manual-access-grant rows',  false,
   jsonb_build_object('legacy_table', 'academy_user_assessment_details', 'organisation_assessment_id', 'manual-access-grant'), 'migration'),
  ('LEGACY_ACCESS_REVOKE', 'Legacy manual-access-revoke rows', false,
   jsonb_build_object('legacy_table', 'academy_user_assessment_details', 'organisation_assessment_id', 'manual-access-revoke'), 'migration');

INSERT INTO irp_v2.student_group_members (group_id, user_id, created_at)
SELECT g.group_id, d.user_id, d.synced_at
FROM public.academy_user_assessment_details d
JOIN irp_v2.student_groups g
  ON g.extra_details->>'organisation_assessment_id' = d.organisation_assessment_id
WHERE d.organisation_assessment_id IN ('manual-access-grant','manual-access-revoke');

-- ---------------------------------------------------------------------------
-- 11. assessment_registrations
-- ---------------------------------------------------------------------------
INSERT INTO irp_v2.assessment_registrations (
  user_id, user_name, track, level, cycle, group_id, assessment_date_label, assessment_date,
  availability, slot_id, slot_name, understands_rules, will_attend, unavailable_reason,
  notify_next_cycle, submitted_at, updated_at)
SELECT r.academy_user_id, r.user_name, 'MERN', r.level, r.cycle, g.group_id,
       r.assessment_date, COALESCE(irp_v2.label_to_date(r.assessment_date),
         -- one label lost its day number; the fortnightly Sunday between 23 Aug and 20 Sep is 6 Sep
         CASE WHEN btrim(r.assessment_date) = '^th September 2026' THEN DATE '2026-09-06' END),
       r.availability, r.slot_id, r.slot_label,
       CASE WHEN r.understands_gc    IS NULL THEN NULL ELSE r.understands_gc    <> 0 END,
       CASE WHEN r.will_attend       IS NULL THEN NULL ELSE r.will_attend       <> 0 END,
       r.unavailability_reason,
       CASE WHEN r.notify_next_cycle IS NULL THEN NULL ELSE r.notify_next_cycle <> 0 END,
       r.submitted_at, r.updated_at
FROM public.l1_cycle_registrations r
LEFT JOIN irp_v2.student_groups g
  ON g.extra_details->>'legacy_table' = 'registration_batches' AND (g.extra_details->>'legacy_id')::int = r.batch_id;

-- ---------------------------------------------------------------------------
-- 12. support_conversations + support_messages
-- ---------------------------------------------------------------------------
-- Chat conversations keep their ids
INSERT INTO irp_v2.support_conversations (conversation_id, user_id, user_name, channel, status, created_at, updated_at)
SELECT c.id, c.academy_user_id, c.user_name, 'CHAT', upper(c.status), c.created_at, c.updated_at
FROM public.support_conversations c;

INSERT INTO irp_v2.support_messages (message_id, conversation_id, sender_type, message, created_at)
SELECT m.id, m.conversation_id, upper(m.sender_type), m.message, m.created_at
FROM public.support_messages m;

-- Contact-form messages: one conversation + one message each (ids offset by 1,000,000)
INSERT INTO irp_v2.support_conversations (conversation_id, user_id, user_name, channel, status, created_at, updated_at)
SELECT 1000000 + c.id, c.academy_user_id, c.user_name, 'CONTACT_FORM', 'OPEN', c.created_at, c.created_at
FROM public.contact_us_messages c;

SELECT setval(pg_get_serial_sequence('irp_v2.support_messages', 'message_id'),
              GREATEST((SELECT COALESCE(max(message_id), 0) FROM irp_v2.support_messages), 1));

INSERT INTO irp_v2.support_messages (conversation_id, sender_type, sender_name, message, created_at)
SELECT 1000000 + c.id, 'STUDENT', c.user_name, c.message, c.created_at
FROM public.contact_us_messages c;

SELECT setval(pg_get_serial_sequence('irp_v2.support_conversations', 'conversation_id'),
              GREATEST((SELECT COALESCE(max(conversation_id), 0) FROM irp_v2.support_conversations), 1));

-- ---------------------------------------------------------------------------
-- 13. activity_logs
-- ---------------------------------------------------------------------------
INSERT INTO irp_v2.activity_logs (activity_type, user_id, details, created_at)
SELECT e.event_type, e.academy_user_id,
       jsonb_strip_nulls(jsonb_build_object('legacy_table', 'dashboard_analytics_events', 'legacy_id', e.id, 'student_id', e.student_id)),
       e.created_at
FROM public.dashboard_analytics_events e;

INSERT INTO irp_v2.activity_logs (activity_type, user_id, details, created_at)
SELECT 'FEEDBACK', f.academy_user_id,
       jsonb_strip_nulls(jsonb_build_object(
         'legacy_table', 'dashboard_feedback', 'legacy_id', f.id, 'student_id', f.student_id,
         'rating', f.rating, 'rating_label', f.rating_label, 'responses', irp_v2.try_jsonb(f.responses))),
       f.created_at
FROM public.dashboard_feedback f;

INSERT INTO irp_v2.activity_logs (activity_type, user_id, details, created_at)
SELECT 'AUTH_CODE', l.user_id,
       jsonb_strip_nulls(to_jsonb(l) - 'user_id' - 'created_at') || jsonb_build_object('legacy_table', 'auth_code_logs'),
       l.created_at
FROM public.auth_code_logs l;

-- ---------------------------------------------------------------------------
-- 14. sync_logs (latest status per old sync table)
-- ---------------------------------------------------------------------------
INSERT INTO irp_v2.sync_logs (job_name, direction, status, row_count, duration_ms, last_synced_until,
                              error_message, started_at, finished_at)
SELECT 'bq_pull:' || s.table_name, 'PULL', upper(s.status), s.row_count, s.duration_ms, s.last_synced_at,
       s.error,
       -- updated_at is when the latest run (success or failure) finished; last_synced_at is the last success.
       s.updated_at - make_interval(secs => COALESCE(s.duration_ms, 0) / 1000.0),
       s.updated_at
FROM public.bigquery_sync_status s;

ANALYZE irp_v2.users, irp_v2.mern_track, irp_v2.genai_track,
        irp_v2.mern_track_attempts, irp_v2.genai_track_attempts;
