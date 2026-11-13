-- DEV DATABASE ONLY: give dev the same GenAI pass marks production has (saved 30 Oct 2026).
-- Without this row the dev dashboard cannot judge GenAI sits, so dev's old-vs-new GenAI check fails.
-- Run inside psql on the dev database:   \i migrations-v2/dev_genai_rules.sql
-- Safe to re-run: does nothing if dev already has a rules row.
INSERT INTO genai_qualification_rules (id, payload, updated_at)
VALUES (1, $$[{"id":"genai-a1","tag":"ACADEMY-GENAI-IRP-2.0_MAIN_ASSESSMENT_A1","fromNumber":1,"toNumber":1,"minMcq":20,"minCoding":48},{"id":"genai-a2-on","tag":"ACADEMY-GENAI-IRP-2.0_MAIN_ASSESSMENT_A2","fromNumber":2,"toNumber":3,"minMcq":20,"minCoding":48},{"id":"rule-lhkbsa","tag":"ACADEMY-GENAI-IRP-2.0_MAIN_ASSESSMENT_A3","fromNumber":3,"toNumber":null,"minMcq":25,"minCoding":48}]$$, now())
ON CONFLICT (id) DO NOTHING;

SELECT id, left(payload, 60) || '...' AS payload_start, updated_at FROM genai_qualification_rules;
