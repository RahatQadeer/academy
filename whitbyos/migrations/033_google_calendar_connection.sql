-- =====================================================================
-- Whitby — what a real Google Calendar connection needs
-- Owner: Sabahat (whitbyos_*)
--
-- Two things, both required before Screen 16's Connect can do anything.
--
-- 1. Somewhere to keep the OAuth grant.
--
--    `whitbyos_integrations` records that a provider is connected, as whom,
--    and when it last synced. It has nowhere to put the refresh token that
--    makes the connection survive the hour an access token lasts. Tokens do
--    not belong beside display state anyway: everything already in that table
--    is meant to be read by the professional on Screen 16, and a refresh token
--    is meant to be read by nobody.
--
--    Hence a separate table with RLS on and no policy at all. That is not the
--    accidental lockout the base schema has 30 of — it is the point. Postgres
--    then denies every read and write to `anon` and `authenticated`, and only
--    the service role, which never leaves the server, can reach it.
--
-- 2. A key to upsert a synced event against.
--
--    A sync runs every time the Calendar is opened. Without a unique index on
--    (workspace, calendar, external id) each run would insert the same Google
--    event again, and a week would grow a duplicate per visit.
--
--    Partial, on `external_event_id is not null`, so events created in Whitby
--    — which have no external id, and would otherwise all collide on null —
--    are unaffected.
--
-- Safe to re-run.
-- =====================================================================

create table if not exists public.whitbyos_integration_credentials (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider public.whitbyos_integration_provider not null,
  account_email text,
  calendar_id text not null default 'primary',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, provider)
);

alter table public.whitbyos_integration_credentials enable row level security;

-- No policy, deliberately. See the note above.
revoke all on public.whitbyos_integration_credentials from anon, authenticated;

create unique index if not exists whitbyos_calendar_events_external_idx
  on public.whitbyos_calendar_events (workspace_id, external_calendar, external_event_id)
  where external_event_id is not null;


-- =====================================================================
-- VERIFY — first should return one row with rowsecurity = true and no
-- policy; second should return the index.
-- =====================================================================
-- select c.relname, c.relrowsecurity, p.polname
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- left join pg_policy p on p.polrelid = c.oid
-- where n.nspname = 'public' and c.relname = 'whitbyos_integration_credentials';
--
-- select indexname from pg_indexes
-- where schemaname = 'public'
--   and indexname = 'whitbyos_calendar_events_external_idx';
