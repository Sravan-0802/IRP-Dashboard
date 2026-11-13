-- =============================================================================
-- IRP data model v2 — step 1: create the 15 new tables in schema irp_v2.
-- Old tables in `public` are not touched. Undo with 09_rollback.sql.
-- =============================================================================

CREATE SCHEMA irp_v2;

-- ---------------------------------------------------------------------------
-- Helpers used by the copy step
-- ---------------------------------------------------------------------------

-- Text → jsonb; invalid JSON is kept as a JSON string instead of failing.
CREATE FUNCTION irp_v2.try_jsonb(t text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t IS NULL OR btrim(t) = '' THEN RETURN NULL; END IF;
  RETURN t::jsonb;
EXCEPTION WHEN others THEN
  RETURN to_jsonb(t);
END $$;

-- Free-text labels like '18th October 2026', 'November 1st', '4th October  2026'
-- → date. Missing year defaults to 2026. Unreadable text → NULL (label is kept).
CREATE FUNCTION irp_v2.label_to_date(label text, default_year int DEFAULT 2026) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d int; m int; y int; mon text;
BEGIN
  IF label IS NULL THEN RETURN NULL; END IF;
  d   := substring(label from '(?<!\d)(\d{1,2})(?!\d)')::int;
  mon := substring(lower(label) from '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)');
  y   := COALESCE(substring(label from '(\d{4})')::int, default_year);
  IF d IS NULL OR mon IS NULL THEN RETURN NULL; END IF;
  m := (position(mon in 'janfebmaraprmayjunjulaugsepoctnovdec') + 2) / 3;
  RETURN make_date(y, m, d);
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- Any source status (BigQuery, Nexus, GenAI) → one of our 4 attempt results.
CREATE FUNCTION irp_v2.map_status(raw text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(replace(btrim(COALESCE(raw, '')), ' ', '_'))
    WHEN ''                    THEN 'NOT_ATTEMPTED'
    WHEN 'QUALIFIED'           THEN 'QUALIFIED'
    WHEN 'CLEARED'             THEN 'QUALIFIED'
    WHEN 'NOT_QUALIFIED'       THEN 'NOT_QUALIFIED'
    WHEN 'NOT_CLEARED'         THEN 'NOT_QUALIFIED'
    WHEN 'NOT_ATTEMPTED'       THEN 'NOT_ATTEMPTED'
    WHEN 'NO_SHOW'             THEN 'NOT_ATTEMPTED'
    WHEN 'DECLINED'            THEN 'NOT_ATTEMPTED'
    WHEN 'CANCELLED'           THEN 'NOT_ATTEMPTED'
    WHEN 'UPCOMING'            THEN 'NOT_ATTEMPTED'
    ELSE 'RESULT_PENDING'      -- PARTIALLY_COMPLETED, COMPLETED, RESULT_PENDING, unknown
  END
$$;

-- ---------------------------------------------------------------------------
-- 1. users — one row per student
-- ---------------------------------------------------------------------------
CREATE TABLE irp_v2.users (
  user_id                 text PRIMARY KEY,
  -- From BigQuery academy_users_basic_details_for_pocs (same column names)
  user_name               text,
  first_name              text,
  last_name               text,
  name_on_certificate     text,
  yog                     integer,
  lpoad                   timestamptz,
  payment_status          text,
  payment_plan            text,
  irp_eligible_status     text,
  lp_status               text,
  product_status          text,
  profile_pic_url         text,
  -- App-owned
  display_name            text,          -- old students.name (fallback name)
  avatar_url              text,          -- old students.avatar
  access_override         text CHECK (access_override IN ('GRANTED','BLOCKED')),
  access_override_reason  text,
  access_override_by      text,
  access_override_at      timestamptz,
  onboarding_completed    boolean NOT NULL DEFAULT false,
  record_source           text NOT NULL DEFAULT 'BIGQUERY'
                          CHECK (record_source IN ('BIGQUERY','NOT_IN_BIGQUERY')),
  synced_at               timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. assessment_criteria — fixed pass mark per assessment_specific_tag
-- ---------------------------------------------------------------------------
CREATE TABLE irp_v2.assessment_criteria (
  criteria_id                      bigserial PRIMARY KEY,
  track                            text NOT NULL CHECK (track IN ('MERN','GENAI')),
  stage                            text NOT NULL CHECK (stage IN ('ASSESSMENT','PROJECT','INTERVIEW','MOCK_INTERVIEW')),
  assessment_specific_tag          text NOT NULL,
  criteria_type                    text NOT NULL CHECK (criteria_type IN ('PERCENTAGE','SECTION_MARKS','EXTERNAL_RESULT')),
  qualifying_score_percentage      real,
  qualifying_theory_section_score  real,
  qualifying_coding_section_score  real,
  valid_from                       timestamptz NOT NULL DEFAULT now(),
  valid_until                      timestamptz,
  reason                           text,
  created_by                       text NOT NULL,
  approved_by                      text,
  created_at                       timestamptz NOT NULL DEFAULT now(),
  CHECK (criteria_type <> 'PERCENTAGE' OR qualifying_score_percentage BETWEEN 0 AND 100),
  CHECK (criteria_type <> 'SECTION_MARKS'
         OR (qualifying_theory_section_score IS NOT NULL AND qualifying_coding_section_score IS NOT NULL))
);
CREATE UNIQUE INDEX assessment_criteria_one_live_per_tag
  ON irp_v2.assessment_criteria (assessment_specific_tag) WHERE valid_until IS NULL;

-- ---------------------------------------------------------------------------
-- 3 + 4. Attempt tables — one row per sit (identical columns)
-- ---------------------------------------------------------------------------
CREATE TABLE irp_v2.mern_track_attempts (
  attempt_id                        bigserial PRIMARY KEY,
  user_id                           text NOT NULL REFERENCES irp_v2.users(user_id) ON DELETE CASCADE,
  stage                             text NOT NULL CHECK (stage IN ('ASSESSMENT','PROJECT','INTERVIEW','MOCK_INTERVIEW')),
  source_system                     text NOT NULL CHECK (source_system IN ('BIGQUERY','BIGQUERY_SUMMARY','NEXUS','MANUAL')),
  organisation_assessment_id        text NOT NULL,
  assessment_specific_tag           text,
  assessment_title                  text,
  assessment_name                   text,
  assessment_type                   text,          -- MAIN | MOCK
  assessment_level                  text,
  assessment_number                 text,          -- A1, A2 … (or C1 for old cycle tags)
  cycle                             text,
  attempt_number                    smallint NOT NULL DEFAULT 1,
  assessment_start_datetime         timestamptz,
  assessment_end_datetime           timestamptz,
  user_assessment_start_datetime    timestamptz,   -- NULL = had access, did not sit
  assessment_actual_score           real,          -- max marks
  user_assessment_score             real,
  user_assessment_score_percentage  real,
  theory_section_actual_score       real,
  theory_section_score              real,
  theory_section_score_percentage   real,
  coding_section_actual_score       real,
  coding_section_score              real,
  coding_section_score_percentage   real,
  section_wise_rating_json          jsonb,         -- interview ratings
  section_details                   jsonb NOT NULL DEFAULT '{}',  -- durations, FE section, legacy refs
  assessment_status                 text,          -- exactly as the source sent it
  qualification_status              text NOT NULL DEFAULT 'RESULT_PENDING'
                                    CHECK (qualification_status IN ('QUALIFIED','NOT_QUALIFIED','NOT_ATTEMPTED','RESULT_PENDING')),
  criteria_id                       bigint REFERENCES irp_v2.assessment_criteria(criteria_id),
  qualifying_score_percentage       real,
  qualifying_theory_section_score   real,
  qualifying_coding_section_score   real,
  evaluated_at                      timestamptz,
  synced_at                         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mern_track_attempts_one_row_per_sit
    UNIQUE (user_id, source_system, organisation_assessment_id, attempt_number)
);
CREATE INDEX mern_track_attempts_user_stage ON irp_v2.mern_track_attempts (user_id, stage);
CREATE INDEX mern_track_attempts_tag        ON irp_v2.mern_track_attempts (assessment_specific_tag);

CREATE TABLE irp_v2.genai_track_attempts (
  attempt_id                        bigserial PRIMARY KEY,
  user_id                           text NOT NULL REFERENCES irp_v2.users(user_id) ON DELETE CASCADE,
  stage                             text NOT NULL CHECK (stage IN ('ASSESSMENT','INTERVIEW','MOCK_INTERVIEW')),
  source_system                     text NOT NULL CHECK (source_system IN ('BIGQUERY','BIGQUERY_SUMMARY','NEXUS','MANUAL')),
  organisation_assessment_id        text NOT NULL,
  assessment_specific_tag           text,
  assessment_title                  text,
  assessment_name                   text,
  assessment_type                   text,
  assessment_level                  text,
  assessment_number                 text,
  cycle                             text,
  attempt_number                    smallint NOT NULL DEFAULT 1,
  assessment_start_datetime         timestamptz,
  assessment_end_datetime           timestamptz,
  user_assessment_start_datetime    timestamptz,
  assessment_actual_score           real,
  user_assessment_score             real,
  user_assessment_score_percentage  real,
  theory_section_actual_score       real,
  theory_section_score              real,
  theory_section_score_percentage   real,
  coding_section_actual_score       real,
  coding_section_score              real,
  coding_section_score_percentage   real,
  section_wise_rating_json          jsonb,
  section_details                   jsonb NOT NULL DEFAULT '{}',
  assessment_status                 text,
  qualification_status              text NOT NULL DEFAULT 'RESULT_PENDING'
                                    CHECK (qualification_status IN ('QUALIFIED','NOT_QUALIFIED','NOT_ATTEMPTED','RESULT_PENDING')),
  criteria_id                       bigint REFERENCES irp_v2.assessment_criteria(criteria_id),
  qualifying_score_percentage       real,
  qualifying_theory_section_score   real,
  qualifying_coding_section_score   real,
  evaluated_at                      timestamptz,
  synced_at                         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT genai_track_attempts_one_row_per_sit
    UNIQUE (user_id, source_system, organisation_assessment_id, attempt_number)
);
CREATE INDEX genai_track_attempts_user_stage ON irp_v2.genai_track_attempts (user_id, stage);
CREATE INDEX genai_track_attempts_tag        ON irp_v2.genai_track_attempts (assessment_specific_tag);

-- ---------------------------------------------------------------------------
-- 5. mern_track — one row per student (names follow BigQuery round-wise summary)
-- ---------------------------------------------------------------------------
CREATE TABLE irp_v2.mern_track (
  user_id                                         text PRIMARY KEY REFERENCES irp_v2.users(user_id) ON DELETE CASCADE,
  -- Online Assessment (Hustler)
  hustler_assessment_status                       text NOT NULL DEFAULT 'ACTIVE',
  hustler_assessment_specific_tag                 text,
  hustler_assessment_number                       text,
  hustler_assessment_attempt_number               smallint,
  hustler_assessment_attempt_date                 timestamptz,
  hustler_assessment_score_percentage             real,
  hustler_assessment_theory_section_score         real,
  hustler_assessment_coding_section_score         real,
  hustler_assessment_qualifying_score_percentage  real,
  hustler_assessment_total_attempts               smallint NOT NULL DEFAULT 0,
  hustler_assessment_best_attempt_id              bigint REFERENCES irp_v2.mern_track_attempts(attempt_id) ON DELETE SET NULL,
  -- FE Project
  fe_project_status                               text NOT NULL DEFAULT 'NOT_ATTEMPTED',
  fe_project_specific_tag                         text,
  fe_project_assessment_number                    text,
  fe_project_attempt_number                       smallint,
  fe_project_attempt_date                         timestamptz,
  fe_project_score_percentage                     real,
  fe_project_qualifying_score_percentage          real,
  fe_project_total_attempts                       smallint NOT NULL DEFAULT 0,
  fe_project_best_attempt_id                      bigint REFERENCES irp_v2.mern_track_attempts(attempt_id) ON DELETE SET NULL,
  -- Human Interview
  human_interview_status                          text NOT NULL DEFAULT 'NOT_ATTEMPTED',
  human_interview_score                           real,
  human_interview_attempt_number                  smallint,
  human_interview_attempt_date                    timestamptz,
  human_interview_total_attempts                  smallint NOT NULL DEFAULT 0,
  human_interview_best_attempt_id                 bigint REFERENCES irp_v2.mern_track_attempts(attempt_id) ON DELETE SET NULL,
  -- AI Mock (reference only)
  nxtmock_status                                  text,
  nxtmock_interview_rating                        real,
  nxtmock_interview_number                        text,
  nxtmock_attempt_number                          smallint,
  nxtmock_attempt_date                            timestamptz,
  -- Level 2 + journey (from old students table)
  level2_status                                   text NOT NULL DEFAULT 'NOT_ATTEMPTED',
  journey_state                                   text NOT NULL DEFAULT 'L1_PREP',
  is_wildcard                                     boolean NOT NULL DEFAULT false,
  has_attempted_level1                            boolean NOT NULL DEFAULT false,
  level3_exam_started                             boolean NOT NULL DEFAULT false,
  reattempt_date                                  text,
  project_submitted                               boolean NOT NULL DEFAULT false,
  project_due_date                                text,
  calculated_at                                   timestamptz,
  updated_at                                      timestamptz NOT NULL DEFAULT now(),
  CHECK (hustler_assessment_status IN ('NOT_ATTEMPTED','ACTIVE','RESULT_PENDING','QUALIFIED','NOT_QUALIFIED')),
  CHECK (fe_project_status         IN ('NOT_ATTEMPTED','ACTIVE','RESULT_PENDING','QUALIFIED','NOT_QUALIFIED')),
  CHECK (human_interview_status    IN ('NOT_ATTEMPTED','ACTIVE','RESULT_PENDING','QUALIFIED','NOT_QUALIFIED')),
  CHECK (level2_status             IN ('NOT_ATTEMPTED','ACTIVE','QUALIFIED'))
);
CREATE INDEX mern_track_fe_status ON irp_v2.mern_track (fe_project_status);
CREATE INDEX mern_track_hi_status ON irp_v2.mern_track (human_interview_status);

-- ---------------------------------------------------------------------------
-- 6. genai_track — one row per student
-- ---------------------------------------------------------------------------
CREATE TABLE irp_v2.genai_track (
  user_id                                           text PRIMARY KEY REFERENCES irp_v2.users(user_id) ON DELETE CASCADE,
  -- Assessment
  genai_assessment_status                           text NOT NULL DEFAULT 'ACTIVE',
  genai_assessment_specific_tag                     text,
  genai_assessment_number                           text,
  genai_assessment_attempt_number                   smallint,
  genai_assessment_attempt_date                     timestamptz,
  genai_assessment_score_percentage                 real,
  genai_assessment_theory_section_score             real,
  genai_assessment_coding_section_score             real,
  genai_assessment_qualifying_theory_section_score  real,
  genai_assessment_qualifying_coding_section_score  real,
  genai_assessment_total_attempts                   smallint NOT NULL DEFAULT 0,
  genai_assessment_best_attempt_id                  bigint REFERENCES irp_v2.genai_track_attempts(attempt_id) ON DELETE SET NULL,
  -- Project submission
  genai_project_status                              text NOT NULL DEFAULT 'NOT_ATTEMPTED',
  genai_selected_projects                           text[] NOT NULL DEFAULT '{}',
  genai_project_title                               text,
  -- Loom video
  genai_video_status                                text NOT NULL DEFAULT 'NOT_ATTEMPTED',
  genai_video_url                                   text,
  genai_video_submitted_at                          timestamptz,
  genai_video_updated_at                            timestamptz,
  -- Human interview
  genai_human_interview_status                      text NOT NULL DEFAULT 'NOT_ATTEMPTED',
  genai_human_interview_score                       real,
  genai_human_interview_attempt_number              smallint,
  genai_human_interview_attempt_date                timestamptz,
  genai_human_interview_total_attempts              smallint NOT NULL DEFAULT 0,
  genai_human_interview_best_attempt_id             bigint REFERENCES irp_v2.genai_track_attempts(attempt_id) ON DELETE SET NULL,
  -- AI Mock (reference only)
  genai_nxtmock_status                              text,
  genai_nxtmock_interview_rating                    real,
  genai_nxtmock_attempt_date                        timestamptz,
  calculated_at                                     timestamptz,
  updated_at                                        timestamptz NOT NULL DEFAULT now(),
  CHECK (genai_assessment_status      IN ('NOT_ATTEMPTED','ACTIVE','RESULT_PENDING','QUALIFIED','NOT_QUALIFIED')),
  CHECK (genai_project_status         IN ('NOT_ATTEMPTED','ACTIVE','QUALIFIED')),
  CHECK (genai_video_status           IN ('NOT_ATTEMPTED','ACTIVE','QUALIFIED')),
  CHECK (genai_human_interview_status IN ('NOT_ATTEMPTED','ACTIVE','RESULT_PENDING','QUALIFIED','NOT_QUALIFIED'))
);

-- ---------------------------------------------------------------------------
-- 7–15. Supporting tables
-- ---------------------------------------------------------------------------
CREATE TABLE irp_v2.login_tokens (
  token_hash  text PRIMARY KEY,            -- sha256 hex of the token; raw token never stored
  user_id     text NOT NULL REFERENCES irp_v2.users(user_id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_tokens_expires ON irp_v2.login_tokens (expires_at);

CREATE TABLE irp_v2.admin_settings (
  setting_key    text PRIMARY KEY,
  setting_value  jsonb NOT NULL,
  updated_by     text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE irp_v2.student_groups (
  group_id               bigserial PRIMARY KEY,
  group_type             text NOT NULL CHECK (group_type IN (
                           'ACCESS_GRANT','REGISTRATION','ALLOWLIST','EXAM_ACCESS','MOCK_ALLOWLIST',
                           'UNPAID','LEGACY_ACCESS_GRANT','LEGACY_ACCESS_REVOKE')),
  track                  text CHECK (track IN ('MERN','GENAI')),
  stage                  text,
  group_name             text,
  link_type              text,             -- mock | main | default
  link_url               text,
  cycle                  smallint,
  assessment_name        text,
  assessment_date_label  text,             -- original free text
  assessment_date        date,             -- parsed; NULL when unreadable
  slot_id                text,
  slot_name              text,
  is_enabled             boolean NOT NULL DEFAULT true,
  starts_at              timestamptz,
  expires_at             timestamptz,
  extra_details          jsonb NOT NULL DEFAULT '{}',
  created_by             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE irp_v2.student_group_members (
  group_id    bigint NOT NULL REFERENCES irp_v2.student_groups(group_id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  added_by    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX student_group_members_user ON irp_v2.student_group_members (user_id);

CREATE TABLE irp_v2.assessment_registrations (
  registration_id        bigserial PRIMARY KEY,
  user_id                text NOT NULL REFERENCES irp_v2.users(user_id) ON DELETE CASCADE,
  user_name              text,
  track                  text NOT NULL DEFAULT 'MERN' CHECK (track IN ('MERN','GENAI')),
  level                  smallint NOT NULL DEFAULT 1,
  cycle                  smallint NOT NULL,
  group_id               bigint REFERENCES irp_v2.student_groups(group_id),
  assessment_date_label  text NOT NULL,
  assessment_date        date,
  availability           text NOT NULL,
  slot_id                text,
  slot_name              text,
  understands_rules      boolean,
  will_attend            boolean,
  unavailable_reason     text,
  notify_next_cycle      boolean,
  submitted_at           timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, track, cycle, level)
);

CREATE TABLE irp_v2.support_conversations (
  conversation_id  bigserial PRIMARY KEY,
  user_id          text NOT NULL REFERENCES irp_v2.users(user_id) ON DELETE CASCADE,
  user_name        text,
  channel          text NOT NULL DEFAULT 'CHAT' CHECK (channel IN ('CHAT','CONTACT_FORM')),
  status           text NOT NULL DEFAULT 'OPEN',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE irp_v2.support_messages (
  message_id       bigserial PRIMARY KEY,
  conversation_id  bigint NOT NULL REFERENCES irp_v2.support_conversations(conversation_id) ON DELETE CASCADE,
  sender_type      text NOT NULL,
  sender_name      text,
  message          text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE irp_v2.activity_logs (
  log_id         bigserial PRIMARY KEY,
  activity_type  text NOT NULL,
  user_id        text,
  details        jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_type_time ON irp_v2.activity_logs (activity_type, created_at);
CREATE INDEX activity_logs_user      ON irp_v2.activity_logs (user_id);

CREATE TABLE irp_v2.sync_logs (
  sync_id            bigserial PRIMARY KEY,
  job_name           text NOT NULL,
  direction          text NOT NULL CHECK (direction IN ('PULL','PUSH')),
  status             text NOT NULL,
  row_count          integer NOT NULL DEFAULT 0,
  duration_ms        integer,
  last_synced_until  timestamptz,
  error_message      text,
  started_at         timestamptz,
  finished_at        timestamptz
);
