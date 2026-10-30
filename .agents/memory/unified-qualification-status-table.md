---
name: Unified qualification status table
description: User requirements for the compact app-owned student assessment qualification table.
---

The user wants one compact table covering L1 Hustler and FE Project assessments with only `user_id`, `assessment_specific_tag`, `assessment_title`, and `qualification_status`. Tags should include the family plus assessment number, such as `L1_HUSTLER_A1` and `FE_PROJECT_A1`; preserve a source `C1`/`C2` suffix when there is no `A#` identifier. When the same student has multiple attempts for the same family/tag/title, the latest attempt supplies the status.

**Why:** The user explicitly requested one place for both assessment families and confirmed the family-plus-number tag format; extra score, source, or timestamp columns are not wanted in this compact table.

**How to apply:** Keep the compact table separate from the BigQuery mirror. Recompute its status using the saved L1 or FE qualification rules, and preserve older detailed per-attempt data rather than deleting it.
