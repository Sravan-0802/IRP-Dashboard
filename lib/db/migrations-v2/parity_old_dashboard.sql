/*
  parity_old_dashboard.sql  --  READ-ONLY reference: the stage result each student sees on the
  dashboard TODAY, derived from the application code (not from the v2 migration).
  One SELECT, no DDL. One row per student with at least one non-NONE value.

  Source functions reproduced
  ---------------------------
  mern_online / mern_fe
    server  artifacts/api-server/src/routes/student.ts
              getAssessmentResultsResponse (459-522), mapDetailAssessmentRow (269-339),
              cycleFromAssessmentFields (226-238), isFeAssessmentApiRow (245-260),
              isValidL1OnlineDetailRow (453-457), isQualifiedStatus (240-243),
              assessmentsFromRoundWise (347-400, hustler row only; the FE round-wise row is never emitted)
            lib/mainOnly.ts isMockLabel / isMainAssessmentFields
            lib/feQualification.ts feAssessmentIndex / requiredFePercentage / getFeAssessmentStatus
            lib/feQualificationRules.ts DEFAULT_FE_QUALIFICATION_RULES (table fe_qualification_rules is empty)
    browser artifacts/irp-dashboard/src/pages/Dashboard.tsx 84-92 (GenAI-label filter)
            lib/assessment.ts isMockAssessment, isFeProjectAssessment, isL1OnlineAssessment,
              parseAssessmentLevel, isValidL1OnlineDetailSit, listAttemptedL1OnlineAssessments,
              isAssessmentSitCleared, assessmentOverallPct, getAssessmentStepStatus,
              listAttemptedFeProjectAssessments, feQualificationStatus, hasClearedFeProject,
              hasAttemptedFeProject
            lib/l1JourneySteps.ts l1HustlerJourneySteps (40-74)
            lib/july26BookingTestUsers.ts (one hardcoded user forced to "active" unless L1 cleared)
  mern_human_interview
    server  lib/humanInterviews.ts getHumanInterviewsForUser, lib/humanInterviewData.ts
              summarizeInterviews / isScoredInterview / interviewTimestamp
    browser lib/humanInterviewClearance.ts withHumanInterviewClearance
  genai_assessment
    server  lib/genaiResults.ts genaiAssessmentStatus (339-357), getGenaiResultsForUser (382-428)
            lib/genaiQualificationRules.ts matchGenaiRule (rules read live from genai_qualification_rules id=1)
    browser pages/GenAiProgram.tsx GenAiJourney 326-337

  Interpretations ("results are released and visible")
  ---------------------------------------------------
  * visibility switches onlineL1Results / humanInterviewResults are treated as ON.
  * journey state is ignored (REATTEMPT_* would show the Online card as "reattempt"; PLACED / L3 are
    clamped to L1 by routes/journey.ts so they never apply).
  * GenAI: a not-qualified student whose program board has a registration "open", or who has an
    UPCOMING (future-dated, unattempted) row, is shown "active" by the browser; here they are
    NOT_QUALIFIED. RESULT_PENDING = not qualified and at least one RESULT_PENDING row.
  * dashboard access gating (who may open the dashboard at all) is not applied.
  * real columns are read as text::float8 so comparisons match JavaScript doubles.
*/
WITH d0 AS (
  SELECT
    user_id,
    organisation_assessment_id AS org_id,
    assessment_title, assessment_tag, level, cycle AS cycle_raw, assessment_status,
    attempt_number, user_assessment_start_datetime,
    assessment_user_score::text::float8        AS aus,
    assessment_total_score::text::float8       AS ats,
    mcq_user_section_score::text::float8       AS mcq_u,
    coding_user_section_score::text::float8    AS cod_u,
    fe_user_section_score::text::float8        AS fe_u,
    COALESCE(mcq_section_max_score::text::float8, 0)    AS mcq_max,
    COALESCE(coding_section_max_score::text::float8, 0) AS coding_max,
    COALESCE(fe_section_max_score::text::float8, 0)     AS fe_max
  FROM academy_user_assessment_details
  -- student.ts 481-485: only these two flag ids are removed ("manual-access-revoke" rows pass
  -- through as empty rows; they are neither L1 nor FE so they change nothing)
  WHERE organisation_assessment_id NOT IN ('manual-access-grant', 'dashboard-access-override')
),
d1 AS (
  SELECT d0.*,
    COALESCE(aus, COALESCE(mcq_u, 0) + COALESCE(cod_u, 0) + COALESCE(fe_u, 0)) AS overall_score,
    COALESCE(ats, mcq_max + coding_max + fe_max)                               AS overall_max,
    (aus IS NOT NULL OR mcq_u IS NOT NULL OR cod_u IS NOT NULL OR fe_u IS NOT NULL
      OR attempt_number IS NOT NULL
      OR (assessment_status IS NOT NULL AND assessment_status ~* 'qualified'))  AS written0,
    COALESCE(
      NULLIF(btrim(cycle_raw, E' \t\n\r'), ''),
      upper(substring(assessment_tag   from '(?i)\y(A\d+)\y')),
      upper(substring(assessment_title from '(?i)\y(A\d+)\y'))
    ) AS cycle
  FROM d0
),
d2 AS (
  SELECT d1.*,
    COALESCE(assessment_tag, cycle)            AS tag_api,
    COALESCE(assessment_title, 'Assessment')   AS title_api,
    COALESCE(level, '')                        AS level_api,
    -- feAssessmentIndex over [cycle, tag, title]: first identifier that yields a number
    COALESCE(
      substring(upper(cycle)            from '(?:^|[_\s-])A(\d+)\y'),
      substring(upper(assessment_tag)   from '(?:^|[_\s-])A(\d+)\y'),
      substring(upper(assessment_title) from '(?:^|[_\s-])A(\d+)\y')
    )::numeric AS fe_n
  FROM d1
),
d3 AS (
  SELECT d2.*,
    upper(level_api) AS ul, upper(COALESCE(tag_api, '')) AS ut, upper(title_api) AS utt,
    CASE WHEN fe_n = 1 THEN 70 WHEN fe_n = 2 THEN 100
         WHEN fe_n BETWEEN 3 AND 6 THEN 90 WHEN fe_n >= 7 THEN 75 END AS fe_required
  FROM d2
),
d4 AS (
  SELECT d3.*,
    (ul LIKE '%FE-PROJECT%' OR ul LIKE '%FE\_PROJECT%' OR ut LIKE '%FE-PROJECT%' OR ut LIKE '%FE\_PROJECT%'
      OR utt LIKE '%FE PROJECT%' OR utt LIKE '%FE-PROJECT%'
      OR (utt LIKE '%MAIN II%' AND (utt LIKE '%IRP%' OR utt LIKE '%PROJECT%'))) AS is_fe_srv,
    -- lib/mainOnly.ts: MOCK in tag or title => not a MAIN sit
    NOT (btrim(ut) ~ '(^|_)MOCK(_|$)' OR btrim(ut) ~ '\yMOCK\y'
      OR btrim(utt) ~ '(^|_)MOCK(_|$)' OR btrim(utt) ~ '\yMOCK\y') AS is_main
  FROM d3
),
d5 AS (
  SELECT d4.*,
    -- mapDetailAssessmentRow 327-337: FE rows get their status recomputed from the score
    CASE WHEN is_fe_srv AND overall_max > 0 THEN
           CASE WHEN fe_required IS NOT NULL AND overall_score / overall_max * 100 >= fe_required THEN 'QUALIFIED'
                WHEN user_assessment_start_datetime IS NOT NULL THEN 'NOT QUALIFIED'
                ELSE 'NOT ATTEMPTED' END
         ELSE assessment_status END AS status_api
  FROM d4
),
d6 AS (
  SELECT d5.*,
    CASE WHEN is_fe_srv THEN status_api IS DISTINCT FROM 'NOT ATTEMPTED' ELSE written0 END AS written,
    (NOT is_fe_srv AND (mcq_max > 0 OR coding_max > 0 OR overall_max >= 100)) AS valid_l1_srv
  FROM d5
  WHERE is_main
),
summary AS (
  SELECT user_id,
    NULLIF(btrim(hustler_assessment_number, E' \t\n\r'), '') AS h_num,
    COALESCE(hustler_assessment_status ~* 'qualified' AND hustler_assessment_status !~* 'not\s*qualified'
      AND btrim(hustler_assessment_status, E' \t\n\r') <> '', false) AS h_qualified
  FROM irp_l1_round_wise_summary
),
srv_l1 AS (  -- users whose summary branch has detailL1.length > 0
  SELECT DISTINCT user_id FROM d6 WHERE written AND valid_l1_srv
),
api_rows AS (  -- what GET /api/student/assessments returns
  SELECT d6.user_id, d6.org_id, d6.title_api, d6.tag_api, d6.ul, d6.ut, d6.utt, d6.level_api,
         d6.mcq_max, d6.coding_max, d6.overall_score, d6.overall_max, d6.status_api, d6.written,
         d6.fe_required, false AS is_rw
  FROM d6 LEFT JOIN summary s USING (user_id)
  WHERE s.user_id IS NULL OR (d6.written AND d6.valid_l1_srv) OR d6.is_fe_srv
  UNION ALL
  -- round-wise hustler fallback: summary says QUALIFIED and there is no written MAIN L1 detail sit
  SELECT s.user_id, 'round-wise:hustler',
         CASE WHEN s.h_num IS NULL THEN 'IRP L1 Hustler Assessment' ELSE 'IRP L1 Hustler Assessment ' || s.h_num END,
         s.h_num, 'L1', upper(COALESCE(s.h_num, '')),
         upper(CASE WHEN s.h_num IS NULL THEN 'IRP L1 Hustler Assessment' ELSE 'IRP L1 Hustler Assessment ' || s.h_num END),
         'L1', 0::float8, 0::float8, NULL::float8, NULL::float8, 'QUALIFIED', true, NULL::int, true
  FROM summary s
  WHERE s.h_qualified AND NOT EXISTS (SELECT 1 FROM srv_l1 x WHERE x.user_id = s.user_id)
),
f1 AS (  -- browser-side classification
  SELECT a.*,
    (ut ~ '(^|_)MOCK(_|$)' OR utt ~ '\yMOCK\y') AS f_mock,
    CASE
      WHEN btrim(level_api) = '' THEN NULL
      WHEN btrim(level_api) ~* 'level\s*\d+' THEN substring(btrim(level_api) from '(?i)level\s*(\d+)')::numeric
      WHEN btrim(level_api) ~* '^L\d+'       THEN substring(btrim(level_api) from '(?i)^L(\d+)')::numeric
      WHEN btrim(level_api) ~ '^\d+$'        THEN btrim(level_api)::numeric
    END AS level_n
  FROM api_rows a
  -- Dashboard.tsx 84-92: GenAI-labelled rows are removed before any stage logic
  WHERE (title_api || ' ' || COALESCE(tag_api, '')) !~* '(^|[^a-z0-9])(gen[\s_-]*ai|generative[\s_-]+ai)($|[^a-z0-9])'
),
f2 AS (
  SELECT f1.*,
    (NOT f_mock AND NOT is_rw AND (
        lower(replace(org_id, '-', '')) IN ('c62633e2059845b68a9829245af43bf4', '0d2986930e6745af9f66cb9dac7f6cfd')
        OR ul LIKE '%FE-PROJECT%' OR ul LIKE '%FE\_PROJECT%' OR ut LIKE '%FE-PROJECT%' OR ut LIKE '%FE\_PROJECT%'
        OR utt LIKE '%FE PROJECT%' OR utt LIKE '%FE-PROJECT%'
        OR (utt LIKE '%MAIN II%' AND (utt LIKE '%IRP%' OR utt LIKE '%PROJECT%'))
        OR (utt LIKE '%FE %' AND utt LIKE '%MAIN%'))) AS is_fe
  FROM f1
),
f3 AS (
  SELECT f2.*,
    (NOT f_mock AND NOT is_fe AND (
        is_rw OR ul LIKE '%ASSESSMENT%' OR ut LIKE '%ASSESSMENT%'
        OR (COALESCE(level_n = 1, false) AND ul NOT LIKE '%FE%'))) AS is_l1,
    -- isAssessmentSitCleared: status wins, otherwise Math.round(overall %) >= 70
    CASE WHEN btrim(COALESCE(status_api, '')) ~* 'not\s*qualified' THEN false
         WHEN btrim(COALESCE(status_api, '')) ~* 'qualified' THEN true
         WHEN overall_max > 0 THEN floor(overall_score / overall_max * 100 + 0.5) >= 70
         ELSE false END AS sit_cleared,
    -- feQualificationStatus
    CASE WHEN upper(btrim(COALESCE(status_api, ''))) IN ('QUALIFIED', 'NOT QUALIFIED', 'NOT ATTEMPTED')
           THEN upper(btrim(status_api))
         WHEN fe_required IS NOT NULL AND overall_max > 0 AND overall_score / overall_max * 100 >= fe_required
           THEN 'QUALIFIED'
         WHEN written THEN 'NOT QUALIFIED' ELSE 'NOT ATTEMPTED' END AS fe_status
  FROM f2
),
mern AS (
  SELECT user_id,
    COALESCE(bool_or(is_l1 AND NOT is_rw AND written AND (mcq_max > 0 OR coding_max > 0 OR overall_max >= 100)), false) AS l1_detail_written,
    COALESCE(bool_or(is_l1 AND NOT is_rw AND written AND (mcq_max > 0 OR coding_max > 0 OR overall_max >= 100) AND sit_cleared), false) AS l1_detail_cleared,
    COALESCE(bool_or(is_l1 AND is_rw), false) AS l1_rw,
    COALESCE(bool_or(is_fe AND written), false) AS fe_attempted,
    COALESCE(bool_or(is_fe AND written AND fe_status = 'QUALIFIED'), false) AS fe_cleared,
    string_agg(DISTINCT tag_api, ',') FILTER (WHERE is_fe AND written AND fe_status = 'QUALIFIED') AS fe_cleared_tags,
    string_agg(DISTINCT COALESCE(tag_api, org_id), ',') FILTER (WHERE is_l1 AND written AND sit_cleared) AS l1_cleared_tags
  FROM f3 GROUP BY user_id
),
mern_res AS (
  SELECT user_id,
    -- listAttemptedL1OnlineAssessments: detail sits win; the round-wise row is used only when there are none
    CASE WHEN l1_detail_written THEN l1_detail_cleared ELSE l1_rw END AS l1_cleared,
    (l1_detail_written OR l1_rw) AS l1_written,
    CASE WHEN l1_detail_written THEN 'detail' WHEN l1_rw THEN 'round-wise' END AS l1_source,
    fe_attempted, fe_cleared, fe_cleared_tags, l1_cleared_tags
  FROM mern
),
mern_final AS (
  SELECT user_id, l1_source, fe_cleared_tags, l1_cleared_tags,
    -- l1JourneySteps.ts 40-54: hardcoded booking test user is forced to "active" unless L1 cleared
    (user_id = '69d3bd59-7b23-4ae5-8fb5-439b505334df' AND NOT l1_cleared) AS forced_booking_track,
    CASE WHEN user_id = '69d3bd59-7b23-4ae5-8fb5-439b505334df' AND NOT l1_cleared THEN 'NONE'
         WHEN NOT l1_written THEN 'NONE'
         WHEN l1_cleared THEN 'QUALIFIED' ELSE 'NOT_QUALIFIED' END AS mern_online,
    CASE WHEN user_id = '69d3bd59-7b23-4ae5-8fb5-439b505334df' AND NOT l1_cleared THEN 'NONE'
         WHEN fe_cleared THEN 'QUALIFIED'
         WHEN fe_attempted THEN 'NOT_QUALIFIED' ELSE 'NONE' END AS mern_fe
  FROM mern_res
),
hi AS (  -- summarizeInterviews: newest scored interview decides
  SELECT DISTINCT ON (candidate_id)
    candidate_id AS user_id, interview_id AS hi_interview_id,
    CASE WHEN clearance_status = 'Cleared' THEN 'QUALIFIED' ELSE 'NOT_QUALIFIED' END AS mern_human_interview
  FROM human_interview_results
  WHERE final_score IS NOT NULL AND clearance_status IN ('Cleared', 'Not Cleared')
  ORDER BY candidate_id, interview_starts_at DESC NULLS LAST, interview_id
),
g_rules AS (
  SELECT (r.ord)::int AS ord, upper(btrim(r.rule->>'tag')) AS tag,
         (r.rule->>'fromNumber')::numeric AS from_n,
         NULLIF(r.rule->>'toNumber', '')::numeric AS to_n,
         (r.rule->>'minMcq')::float8 AS min_mcq, (r.rule->>'minCoding')::float8 AS min_coding
  FROM genai_qualification_rules q, jsonb_array_elements(q.payload::jsonb) WITH ORDINALITY AS r(rule, ord)
  WHERE q.id = 1
),
g0 AS (
  SELECT user_id, organisation_assessment_id, assessment_tag, assessment_number, attempted,
    mcq_score::text::float8 AS mcq, coding_score::text::float8 AS coding,
    COALESCE(
      CASE WHEN btrim(COALESCE(assessment_tag, '')) <> '' THEN substring(upper(assessment_tag) from '(?:^|[_\s-])A(\d+)\y') END,
      CASE WHEN btrim(COALESCE(assessment_number, '')) <> '' THEN substring(upper(assessment_number) from '(?:^|[_\s-])A(\d+)\y') END
    )::numeric AS n
  FROM academy_user_genai_assessment_details
),
g1 AS (
  SELECT g0.*, m.min_mcq, m.min_coding, m.tag AS rule_tag
  FROM g0 LEFT JOIN LATERAL (
    -- matchGenaiRule: exact tag (-1) beats ranges; narrowest range wins; first rule wins ties
    SELECT r.*, CASE
        WHEN r.tag <> '' AND r.tag IN (upper(btrim(COALESCE(NULLIF(btrim(g0.assessment_tag), ''), chr(1)))),
                                       upper(btrim(COALESCE(NULLIF(btrim(g0.assessment_number), ''), chr(1))))) THEN -1
        WHEN g0.n IS NOT NULL AND g0.n >= r.from_n AND (r.to_n IS NULL OR g0.n <= r.to_n)
          THEN COALESCE(r.to_n - r.from_n, 10000) END AS span
    FROM g_rules r
    ORDER BY span NULLS LAST, r.ord LIMIT 1
  ) m ON m.span IS NOT NULL
),
g2 AS (
  SELECT g1.*,
    CASE WHEN attempted <> 1 THEN 'NOT_ATTEMPTED_OR_UPCOMING'
         WHEN mcq IS NULL AND coding IS NULL THEN 'RESULT_PENDING'
         WHEN min_mcq IS NULL THEN 'RESULT_PENDING'
         WHEN COALESCE(mcq, 0) >= min_mcq AND COALESCE(coding, 0) >= min_coding THEN 'QUALIFIED'
         ELSE 'NOT_QUALIFIED' END AS status
  FROM g1
),
genai AS (
  SELECT user_id,
    CASE WHEN bool_or(status = 'QUALIFIED') THEN 'QUALIFIED'
         WHEN bool_or(status = 'RESULT_PENDING') THEN 'RESULT_PENDING'
         WHEN bool_or(status = 'NOT_QUALIFIED') THEN 'NOT_QUALIFIED'
         ELSE 'NONE' END AS genai_assessment,
    string_agg(DISTINCT assessment_number, ',') FILTER (WHERE status = 'QUALIFIED') AS genai_qualified_in
  FROM g2 GROUP BY user_id
),
users AS (
  SELECT user_id FROM mern_final UNION SELECT user_id FROM hi UNION SELECT user_id FROM genai
)
SELECT
  u.user_id::text                                   AS user_id,
  COALESCE(m.mern_online, 'NONE')                   AS mern_online,
  COALESCE(m.mern_fe, 'NONE')                       AS mern_fe,
  COALESCE(h.mern_human_interview, 'NONE')          AS mern_human_interview,
  COALESCE(g.genai_assessment, 'NONE')              AS genai_assessment,
  m.l1_source                                       AS online_source,
  m.l1_cleared_tags                                 AS online_cleared_in,
  m.fe_cleared_tags                                 AS fe_cleared_in,
  h.hi_interview_id                                 AS human_interview_decided_by,
  g.genai_qualified_in                              AS genai_qualified_in,
  COALESCE(m.forced_booking_track, false)           AS forced_booking_track
FROM users u
LEFT JOIN mern_final m USING (user_id)
LEFT JOIN hi h USING (user_id)
LEFT JOIN genai g USING (user_id)
WHERE COALESCE(m.mern_online, 'NONE') <> 'NONE'
   OR COALESCE(m.mern_fe, 'NONE') <> 'NONE'
   OR COALESCE(h.mern_human_interview, 'NONE') <> 'NONE'
   OR COALESCE(g.genai_assessment, 'NONE') <> 'NONE'
ORDER BY u.user_id
