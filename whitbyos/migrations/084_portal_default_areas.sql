-- =====================================================================
-- Whitby — what a new portal login starts with
-- Owner: Sabahat (whitbyos_*)
--
-- Which of the nine portal areas are ticked when somebody is given access to
-- a client's portal. It was a `defaultOn` flag hardcoded in two files — one
-- read by the professional's approval screen, one by the client's own "add a
-- person" modal — and nothing failed when the two disagreed, which they
-- already did.
--
-- Null means "whatever the code ships with", so a workspace that has never
-- opened the setting keeps today's behaviour exactly.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_workspace_settings
  add column if not exists portal_default_areas jsonb;


-- =====================================================================
-- VERIFY — should return one row.
-- =====================================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_workspace_settings'
--   and column_name = 'portal_default_areas';
