-- =====================================================================
-- Client Portal 018 — a client's own integrations
-- Owner: Rohail (client_portal_*). Sign-off: Laiba (base `contacts`,
-- `workspaces` referenced by foreign key).
--
-- Whitby's Integrations (whitbyos/023, 033, 034, 057, 060) connect a mailbox
-- and a calendar to a *workspace*: one Gmail per family office, read on behalf
-- of its staff, filed into tables every member of that workspace can select.
-- A client's mailbox and calendar are not the workspace's. They belong to one
-- person, and what is read out of them is for that person only — a client's
-- dentist appointment is not the family office's business, and nor is the
-- email they sent their accountant.
--
-- So the portal keeps the same five tables, keyed on the contact instead of
-- the workspace:
--
--   client_portal_integrations              ↔ whitbyos_integrations
--   client_portal_integration_credentials   ↔ whitbyos_integration_credentials
--   client_portal_gmail_sources             ↔ whitbyos_gmail_context_sources
--   client_portal_gmail_extracts            ↔ whitbyos_gmail_extracts
--   client_portal_calendar_events           ↔ the synced rows of whitbyos_calendar_events
--
-- The columns are Whitby's, so the two sides read alike; nothing is shared.
--
-- WHO CAN REACH THEM
--
-- Row-level security on, and no policy on any of the five. Every read and
-- write goes through the portal's server code on the service role, filtered on
-- the contact the signed-in session resolves to (`getPortalContext`). That is
-- the rule `whitbyos_integration_credentials` already follows, applied to the
-- rest because two of these tables hold things a browser must never be handed
-- directly: tokens, and the address of each professional a client chose to
-- read mail from — the portal never exposes `users.email`.
--
-- Provider and status are text with checks rather than Whitby's enums, so this
-- module does not alter or depend on a type Sabahat owns.
--
-- Safe to re-run: every object is `if not exists`, one transaction.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. What is connected, as the Integrations screen shows it.
--
-- `workspace_id` is the account the person was working in when they
-- connected. The sync needs it to bill the reading of mail to the right
-- family office, and to raise the bell on the right account.
-- ---------------------------------------------------------------------
create table if not exists public.client_portal_integrations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  client_id uuid,
  provider text not null,
  status text not null default 'disconnected',
  connected_account text,
  scopes text,
  last_sync_at timestamptz,
  error_state text,
  sync_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_portal_integrations_provider_chk
    check (provider in ('gmail', 'google_calendar', 'outlook_mail', 'outlook_calendar')),
  constraint client_portal_integrations_status_chk
    check (status in ('connected', 'needs_attention', 'disconnected'))
);

create unique index if not exists client_portal_integrations_contact_provider_idx
  on public.client_portal_integrations (contact_id, provider);

-- ---------------------------------------------------------------------
-- 2. The grant. Read by nobody but the server.
-- ---------------------------------------------------------------------
create table if not exists public.client_portal_integration_credentials (
  contact_id uuid not null references public.contacts (id) on delete cascade,
  provider text not null,
  account_email text,
  external_account_id text,
  calendar_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  -- Gmail's history id, as whitbyos/060 keeps it.
  sync_cursor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (contact_id, provider)
);

-- ---------------------------------------------------------------------
-- 3. Whose mail may be read. No row, no reading — whitbyos/060's rule.
--
-- `team` is a professional on the account (source_id = users.id),
-- `person` someone else on the client account (source_id = contacts.id),
-- `external` an address typed by hand.
-- ---------------------------------------------------------------------
create table if not exists public.client_portal_gmail_sources (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  kind text not null,
  source_id uuid,
  email text not null,
  label text not null,
  created_at timestamptz not null default now(),
  constraint client_portal_gmail_sources_kind_chk
    check (kind in ('team', 'person', 'external'))
);

create unique index if not exists client_portal_gmail_sources_email_idx
  on public.client_portal_gmail_sources (contact_id, email);

-- ---------------------------------------------------------------------
-- 4. What a read message left behind. The body is not stored — the
--    envelope, Gmail's own snippet, a summary and the facts, as 060.
-- ---------------------------------------------------------------------
create table if not exists public.client_portal_gmail_extracts (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text,
  direction text not null default 'incoming',
  from_email text not null,
  from_name text,
  subject text,
  snippet text,
  received_at timestamptz,
  source_id uuid references public.client_portal_gmail_sources (id) on delete set null,
  summary text,
  extracted jsonb not null default '{}'::jsonb,
  relevant boolean not null default false,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint client_portal_gmail_extracts_direction_chk
    check (direction in ('incoming', 'outgoing'))
);

create unique index if not exists client_portal_gmail_extracts_message_idx
  on public.client_portal_gmail_extracts (contact_id, gmail_message_id);

create index if not exists client_portal_gmail_extracts_contact_idx
  on public.client_portal_gmail_extracts (contact_id, received_at desc);

-- ---------------------------------------------------------------------
-- 5. A connected calendar's events, for the portal Calendar.
--
-- A plain unique index (not partial), for the reason whitbyos/034 gives:
-- PostgREST cannot send the predicate a partial index needs for ON CONFLICT.
-- ---------------------------------------------------------------------
create table if not exists public.client_portal_calendar_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  location text,
  attendees text,
  html_link text,
  declined boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_portal_calendar_events_external_idx
  on public.client_portal_calendar_events (contact_id, provider, external_event_id);

create index if not exists client_portal_calendar_events_window_idx
  on public.client_portal_calendar_events (contact_id, start_at);

-- ---------------------------------------------------------------------
-- 6. RLS on, no policy, no grants. Service role only.
-- ---------------------------------------------------------------------
alter table public.client_portal_integrations enable row level security;
alter table public.client_portal_integration_credentials enable row level security;
alter table public.client_portal_gmail_sources enable row level security;
alter table public.client_portal_gmail_extracts enable row level security;
alter table public.client_portal_calendar_events enable row level security;

revoke all on public.client_portal_integrations from anon, authenticated;
revoke all on public.client_portal_integration_credentials from anon, authenticated;
revoke all on public.client_portal_gmail_sources from anon, authenticated;
revoke all on public.client_portal_gmail_extracts from anon, authenticated;
revoke all on public.client_portal_calendar_events from anon, authenticated;

commit;

-- =====================================================================
-- VERIFY — five rows, rowsecurity true, no policy name on any of them.
-- =====================================================================
-- select c.relname, c.relrowsecurity, p.polname
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- left join pg_policy p on p.polrelid = c.oid
-- where n.nspname = 'public'
--   and c.relname like 'client_portal_%'
--   and c.relname in (
--     'client_portal_integrations', 'client_portal_integration_credentials',
--     'client_portal_gmail_sources', 'client_portal_gmail_extracts',
--     'client_portal_calendar_events'
--   );
