-- =====================================================================
-- Whitby — the Client Portal's own switch
-- Owner: Sabahat (whitbyos_*)
--
-- Whether this workspace's clients may use the portal at all. Until now the
-- portal was open to anyone holding an invitation and there was no way to
-- close it — not for a relationship that has ended, not for an hour while
-- something is being corrected, not at all.
--
-- `true` by default, so nothing changes for a workspace that never touches it.
--
-- Closing it is enforced where the portal decides who somebody is
-- (`getPortalContext`), so it refuses every screen and every action rather
-- than only hiding the nav — and the portal layout signs the person out, so a
-- session that was already open does not survive the switch.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_workspace_settings
  add column if not exists portal_enabled boolean not null default true;


-- =====================================================================
-- VERIFY — should return one row, boolean, default true.
-- =====================================================================
-- select column_name, data_type, column_default, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_workspace_settings'
--   and column_name = 'portal_enabled';
