-- =====================================================================
-- Whitby — client current summary and next action
-- Owner: Sabahat (whitbyos_*)
--
-- SRS §5.3.3's Overview section names both: "profile, Client type, status,
-- owner or team, current summary, next action, and recent activity". Every
-- other field on that list already exists; these two had nowhere to live.
--
-- §5.3.2 also lists "the recommended next action" among what opening a Client
-- must show, so this is not optional detail.
--
-- Kept as columns rather than folded into `preferences`: that jsonb holds the
-- Preferences and Handling section (§5.3.3 section 2), which is a different
-- thing — how to deal with this client, versus where their work stands.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_clients
  add column if not exists current_summary text;

alter table public.whitbyos_clients
  add column if not exists next_action text;


-- =====================================================================
-- VERIFY — should return two rows.
-- =====================================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_clients'
--   and column_name in ('current_summary', 'next_action')
-- order by 1;
