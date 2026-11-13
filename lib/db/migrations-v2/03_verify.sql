-- =============================================================================
-- IRP data model v2 — step 3: checks. ONE SELECT, read-only.
-- Every row is one check: expected (from the old public.* tables) vs actual (irp_v2.*).
-- result = 'PASS' or 'FAIL'. The migration is accepted only when no row is FAIL.
-- Needs irp_v2.parity_old_dashboard (built by steps.mjs verify() from parity_old_dashboard.sql).
-- =============================================================================
WITH
-- ---------- what students see today vs the new track rows ----------
new_status AS (
  SELECT m.user_id,
         CASE m.hustler_assessment_status WHEN 'QUALIFIED' THEN 'QUALIFIED' WHEN 'NOT_QUALIFIED' THEN 'NOT_QUALIFIED'
              WHEN 'RESULT_PENDING' THEN 'RESULT_PENDING' ELSE 'NONE' END AS mern_online,
         CASE m.fe_project_status WHEN 'QUALIFIED' THEN 'QUALIFIED' WHEN 'NOT_QUALIFIED' THEN 'NOT_QUALIFIED'
              WHEN 'RESULT_PENDING' THEN 'RESULT_PENDING' ELSE 'NONE' END AS mern_fe,
         CASE m.human_interview_status WHEN 'QUALIFIED' THEN 'QUALIFIED' WHEN 'NOT_QUALIFIED' THEN 'NOT_QUALIFIED'
              WHEN 'RESULT_PENDING' THEN 'RESULT_PENDING' ELSE 'NONE' END AS mern_human_interview,
         CASE g.genai_assessment_status WHEN 'QUALIFIED' THEN 'QUALIFIED' WHEN 'NOT_QUALIFIED' THEN 'NOT_QUALIFIED'
              WHEN 'RESULT_PENDING' THEN 'RESULT_PENDING' ELSE 'NONE' END AS genai_assessment
  FROM irp_v2.mern_track m
  JOIN irp_v2.genai_track g USING (user_id)
),
parity AS (
  SELECT COALESCE(p.user_id, n.user_id) AS user_id,
         COALESCE(p.mern_online, 'NONE') AS old_online, COALESCE(n.mern_online, 'NONE') AS new_online,
         COALESCE(p.mern_fe, 'NONE') AS old_fe, COALESCE(n.mern_fe, 'NONE') AS new_fe,
         COALESCE(p.mern_human_interview, 'NONE') AS old_hi, COALESCE(n.mern_human_interview, 'NONE') AS new_hi,
         COALESCE(p.genai_assessment, 'NONE') AS old_genai, COALESCE(n.genai_assessment, 'NONE') AS new_genai
  FROM irp_v2.parity_old_dashboard p
  FULL JOIN new_status n ON n.user_id = p.user_id
  -- the one hardcoded booking-test user is a code rule, not data; excluded from parity
  WHERE COALESCE(p.user_id, n.user_id) NOT IN
        (SELECT user_id FROM irp_v2.parity_old_dashboard WHERE forced_booking_track)
),
-- ---------- every old user id must exist in the new users table ----------
old_ids AS (
  SELECT user_id AS uid FROM public.academy_user_basic_details
  UNION SELECT user_id FROM public.academy_user_assessment_details
  UNION SELECT user_id FROM public.academy_user_nxtmock_details
  UNION SELECT user_id FROM public.academy_user_course_progress
  UNION SELECT user_id FROM public.academy_user_genai_assessment_details
  UNION SELECT user_id FROM public.academy_user_genai_nxtmock_details
  UNION SELECT candidate_id FROM public.human_interview_results
  UNION SELECT user_id FROM public.irp_l1_round_wise_summary
  UNION SELECT user_id FROM public.genai_project_submissions
  UNION SELECT academy_user_id FROM public.l1_cycle_registrations
  UNION SELECT academy_user_id FROM public.support_conversations
  UNION SELECT academy_user_id FROM public.contact_us_messages
  UNION SELECT academy_user_id FROM public.blocked_users
),
checks(section, check_name, expected, actual) AS (
  -- 1. One row per user in both tracks
  SELECT 'users', 'old user ids missing from irp_v2.users', 0::numeric,
         (SELECT count(*) FROM old_ids o WHERE o.uid IS NOT NULL AND btrim(o.uid) <> ''
            AND NOT EXISTS (SELECT 1 FROM irp_v2.users u WHERE u.user_id = o.uid))::numeric
  UNION ALL SELECT 'users', 'BigQuery basic-details users', (SELECT count(*) FROM public.academy_user_basic_details),
         (SELECT count(*) FROM irp_v2.users WHERE record_source = 'BIGQUERY')
  UNION ALL SELECT 'users', 'mern_track rows = users', (SELECT count(*) FROM irp_v2.users), (SELECT count(*) FROM irp_v2.mern_track)
  UNION ALL SELECT 'users', 'genai_track rows = users', (SELECT count(*) FROM irp_v2.users), (SELECT count(*) FROM irp_v2.genai_track)
  UNION ALL SELECT 'users', 'blocked users', (SELECT count(DISTINCT academy_user_id) FROM public.blocked_users),
         (SELECT count(*) FROM irp_v2.users WHERE access_override = 'BLOCKED')
  UNION ALL SELECT 'users', 'admin access grants (not blocked)',
         (SELECT count(DISTINCT d.user_id) FROM public.academy_user_assessment_details d
           WHERE d.organisation_assessment_id = 'dashboard-access-override'
             AND d.user_id NOT IN (SELECT academy_user_id FROM public.blocked_users WHERE academy_user_id IS NOT NULL)),
         (SELECT count(*) FROM irp_v2.users WHERE access_override = 'GRANTED')

  -- 2. Every old attempt row landed exactly once
  UNION ALL SELECT 'attempts', 'assessment detail rows (excl. access flags)',
         (SELECT count(*) FROM public.academy_user_assessment_details
           WHERE organisation_assessment_id NOT IN ('manual-access-grant','manual-access-revoke','dashboard-access-override')),
         (SELECT count(*) FROM irp_v2.mern_track_attempts WHERE section_details->>'legacy_table' = 'academy_user_assessment_details')
  UNION ALL SELECT 'attempts', 'NxtMock rows', (SELECT count(*) FROM public.academy_user_nxtmock_details),
         (SELECT count(*) FROM irp_v2.mern_track_attempts WHERE section_details->>'legacy_table' = 'academy_user_nxtmock_details')
  UNION ALL SELECT 'attempts', 'human interview rows', (SELECT count(*) FROM public.human_interview_results),
         (SELECT count(*) FROM irp_v2.mern_track_attempts WHERE stage = 'INTERVIEW')
  UNION ALL SELECT 'attempts', 'GenAI assessment rows', (SELECT count(*) FROM public.academy_user_genai_assessment_details),
         (SELECT count(*) FROM irp_v2.genai_track_attempts WHERE stage = 'ASSESSMENT')
  UNION ALL SELECT 'attempts', 'GenAI NxtMock rows', (SELECT count(*) FROM public.academy_user_genai_nxtmock_details),
         (SELECT count(*) FROM irp_v2.genai_track_attempts WHERE stage = 'MOCK_INTERVIEW')

  -- 3. No score lost: totals match the old tables
  UNION ALL SELECT 'scores', 'sum of assessment user scores',
         (SELECT round(COALESCE(sum(assessment_user_score::numeric), 0), 2) FROM public.academy_user_assessment_details
           WHERE organisation_assessment_id NOT IN ('manual-access-grant','manual-access-revoke','dashboard-access-override')),
         (SELECT round(COALESCE(sum(user_assessment_score::numeric), 0), 2) FROM irp_v2.mern_track_attempts
           WHERE section_details->>'legacy_table' = 'academy_user_assessment_details')
  UNION ALL SELECT 'scores', 'sum of MCQ (theory) section scores',
         (SELECT round(COALESCE(sum(mcq_user_section_score::numeric), 0), 2) FROM public.academy_user_assessment_details
           WHERE organisation_assessment_id NOT IN ('manual-access-grant','manual-access-revoke','dashboard-access-override')),
         (SELECT round(COALESCE(sum(theory_section_score::numeric), 0), 2) FROM irp_v2.mern_track_attempts
           WHERE section_details->>'legacy_table' = 'academy_user_assessment_details')
  UNION ALL SELECT 'scores', 'sum of coding section scores',
         (SELECT round(COALESCE(sum(coding_user_section_score::numeric), 0), 2) FROM public.academy_user_assessment_details
           WHERE organisation_assessment_id NOT IN ('manual-access-grant','manual-access-revoke','dashboard-access-override')),
         (SELECT round(COALESCE(sum(coding_section_score::numeric), 0), 2) FROM irp_v2.mern_track_attempts
           WHERE section_details->>'legacy_table' = 'academy_user_assessment_details')
  UNION ALL SELECT 'scores', 'sum of human interview final scores',
         (SELECT round(COALESCE(sum(final_score::numeric), 0), 2) FROM public.human_interview_results),
         (SELECT round(COALESCE(sum(user_assessment_score::numeric), 0), 2) FROM irp_v2.mern_track_attempts WHERE stage = 'INTERVIEW')
  UNION ALL SELECT 'scores', 'sum of GenAI MCQ scores',
         (SELECT round(COALESCE(sum(mcq_score::numeric), 0), 2) FROM public.academy_user_genai_assessment_details),
         (SELECT round(COALESCE(sum(theory_section_score::numeric), 0), 2) FROM irp_v2.genai_track_attempts WHERE stage = 'ASSESSMENT')
  UNION ALL SELECT 'scores', 'sum of GenAI coding scores',
         (SELECT round(COALESCE(sum(coding_score::numeric), 0), 2) FROM public.academy_user_genai_assessment_details),
         (SELECT round(COALESCE(sum(coding_section_score::numeric), 0), 2) FROM irp_v2.genai_track_attempts WHERE stage = 'ASSESSMENT')

  -- 4. Every student's stage result equals what the dashboard shows today
  UNION ALL SELECT 'parity', 'Online Assessment: students whose result changes', 0, (SELECT count(*) FROM parity WHERE old_online <> new_online)
  UNION ALL SELECT 'parity', 'FE Project: students whose result changes',        0, (SELECT count(*) FROM parity WHERE old_fe <> new_fe)
  UNION ALL SELECT 'parity', 'Human Interview: students whose result changes',   0, (SELECT count(*) FROM parity WHERE old_hi <> new_hi)
  UNION ALL SELECT 'parity', 'GenAI Assessment: students whose result changes',  0, (SELECT count(*) FROM parity WHERE old_genai <> new_genai)
  UNION ALL SELECT 'parity', 'Online Assessment QUALIFIED count',
         (SELECT count(*) FROM parity WHERE old_online = 'QUALIFIED'), (SELECT count(*) FROM parity WHERE new_online = 'QUALIFIED')
  UNION ALL SELECT 'parity', 'FE Project QUALIFIED count',
         (SELECT count(*) FROM parity WHERE old_fe = 'QUALIFIED'), (SELECT count(*) FROM parity WHERE new_fe = 'QUALIFIED')
  UNION ALL SELECT 'parity', 'Human Interview QUALIFIED count',
         (SELECT count(*) FROM parity WHERE old_hi = 'QUALIFIED'), (SELECT count(*) FROM parity WHERE new_hi = 'QUALIFIED')
  UNION ALL SELECT 'parity', 'GenAI Assessment QUALIFIED count',
         (SELECT count(*) FROM parity WHERE old_genai = 'QUALIFIED'), (SELECT count(*) FROM parity WHERE new_genai = 'QUALIFIED')

  -- 5. Allowed values only
  UNION ALL SELECT 'values', 'attempts with an unknown qualification_status', 0,
         (SELECT count(*) FROM (SELECT qualification_status FROM irp_v2.mern_track_attempts
                                UNION ALL SELECT qualification_status FROM irp_v2.genai_track_attempts) x
           WHERE x.qualification_status IS NULL
              OR x.qualification_status NOT IN ('QUALIFIED','NOT_QUALIFIED','NOT_ATTEMPTED','RESULT_PENDING'))
  UNION ALL SELECT 'values', 'criteria tags with more than one live row', 0,
         (SELECT count(*) FROM (SELECT assessment_specific_tag FROM irp_v2.assessment_criteria
                                WHERE valid_until IS NULL GROUP BY 1 HAVING count(*) > 1) x)
  UNION ALL SELECT 'values', 'short tags left un-rebuilt (A1, A2 ...)', 0,
         (SELECT count(*) FROM irp_v2.mern_track_attempts WHERE assessment_specific_tag ~ '^A[0-9]+$')

  -- 6. Supporting tables
  UNION ALL SELECT 'support', 'registrations', (SELECT count(*) FROM public.l1_cycle_registrations),
         (SELECT count(*) FROM irp_v2.assessment_registrations)
  UNION ALL SELECT 'support', 'registrations whose date could not be read', 0,
         (SELECT count(*) FROM irp_v2.assessment_registrations
           WHERE assessment_date IS NULL AND btrim(COALESCE(assessment_date_label, '')) <> '')
  UNION ALL SELECT 'support', 'support conversations (chat + contact form)',
         (SELECT count(*) FROM public.support_conversations) + (SELECT count(*) FROM public.contact_us_messages),
         (SELECT count(*) FROM irp_v2.support_conversations)
  UNION ALL SELECT 'support', 'support messages (chat + contact form)',
         (SELECT count(*) FROM public.support_messages) + (SELECT count(*) FROM public.contact_us_messages),
         (SELECT count(*) FROM irp_v2.support_messages)
  UNION ALL SELECT 'support', 'activity logs (analytics + feedback + auth codes)',
         (SELECT count(*) FROM public.dashboard_analytics_events) + (SELECT count(*) FROM public.dashboard_feedback)
           + (SELECT count(*) FROM public.auth_code_logs),
         (SELECT count(*) FROM irp_v2.activity_logs)
  UNION ALL SELECT 'support', 'valid login tokens', (SELECT count(*) FROM public.forms_auth_tokens WHERE expires_at > now()),
         (SELECT count(*) FROM irp_v2.login_tokens)
  UNION ALL SELECT 'support', 'sync status rows', (SELECT count(*) FROM public.bigquery_sync_status),
         (SELECT count(*) FROM irp_v2.sync_logs)
  UNION ALL SELECT 'support', 'GenAI project submissions', (SELECT count(*) FROM public.genai_project_submissions),
         (SELECT count(*) FROM irp_v2.genai_track WHERE genai_video_submitted_at IS NOT NULL)
)
SELECT section, check_name, expected, actual,
       CASE WHEN expected IS NOT DISTINCT FROM actual THEN 'PASS' ELSE 'FAIL' END AS result
FROM checks
ORDER BY CASE WHEN expected IS NOT DISTINCT FROM actual THEN 1 ELSE 0 END, section, check_name
