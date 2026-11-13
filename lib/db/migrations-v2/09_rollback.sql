-- IRP data model v2 — undo. Removes everything 01_create.sql and 02_copy.sql made.
-- The old tables in `public` are never touched by the migration, so nothing else needs restoring.
DROP SCHEMA IF EXISTS irp_v2 CASCADE;
