-- =====================================================================
-- Whitby — the two keys a connect and a sync upsert against
-- Owner: Sabahat (whitbyos_*)
--
-- 1. `whitbyos_integrations` has no unique on (workspace_id, provider).
--
--    Nothing in the schema said a workspace has one row per provider, so
--    connecting Google Calendar failed on "there is no unique or exclusion
--    constraint matching the ON CONFLICT specification" — and it was right to.
--    Without it, reconnecting would add a second Google Calendar row rather
--    than updating the first, and Screen 16 would list the provider twice with
--    no way to say which one is true.
--
-- 2. 033's index on `whitbyos_calendar_events` is partial, and cannot be used.
--
--    Postgres will only infer a partial index for ON CONFLICT if the statement
--    repeats the index's own WHERE clause, which PostgREST has no way to send.
--    So the index existed and the sync could not reach it.
--
--    The predicate was unnecessary anyway. It was there to stop events created
--    in Whitby — which have no external id — from colliding on null. They
--    cannot: Postgres treats each null as distinct in a unique index, so any
--    number of rows with (workspace, null, null) coexist. A plain index is
--    both usable and the constraint actually meant: one row per external event
--    per calendar per workspace.
--
-- Unique indexes rather than named constraints, because ON CONFLICT infers
-- from either and only an index can be written `if not exists`. Both tables
-- were checked for duplicates first; there are none.
--
-- Safe to re-run.
-- =====================================================================

create unique index if not exists whitbyos_integrations_workspace_provider_idx
  on public.whitbyos_integrations (workspace_id, provider);

drop index if exists public.whitbyos_calendar_events_external_idx;

create unique index if not exists whitbyos_calendar_events_external_idx
  on public.whitbyos_calendar_events (workspace_id, external_calendar, external_event_id);


-- =====================================================================
-- VERIFY — two rows, neither with a WHERE clause on the end.
-- =====================================================================
-- select indexname, indexdef from pg_indexes
-- where schemaname = 'public'
--   and indexname in (
--     'whitbyos_integrations_workspace_provider_idx',
--     'whitbyos_calendar_events_external_idx'
--   );
