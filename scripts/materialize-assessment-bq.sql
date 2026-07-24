-- Run once with a BigQuery admin account that can read retention_academy_analytics.
-- Creates a physical copy in the portal dataset so the IRP service account can sync all users.
--
-- After this succeeds:
--   cd artifacts/api-server && node sync-assessment.mjs

CREATE OR REPLACE TABLE `kossip-helpers.academy_student_success_pocs.academy_users_irp_main_assessment_details_for_irp_portal` AS
SELECT
  user_id,
  organisation_assessment_id,
  assessment_title,
  assessment_tag_str_extracted,
  level,
  cycle,
  assessment_start_datetime,
  assessment_end_datetime,
  user_assesment_start_datetime,
  mcq_section_max_score,
  mcq_user_section_score,
  mcq_user_attempt_duration_in_mins,
  coding_section_max_score,
  coding_user_section_score,
  coding_user_attempt_duration_in_mins,
  fe_section_max_score,
  fe_user_section_score,
  fe_user_attempt_duration_in_mins,
  assessment_total_score,
  assessment_user_score
FROM `kossip-helpers.retention_academy_analytics.y_academy_users_irp_assessment_details`
WHERE exam_type = "MAIN"
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY user_id, level
  ORDER BY user_assesment_start_datetime DESC
) = 1;
