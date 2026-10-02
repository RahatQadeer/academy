-- 060 — who Whitby AI may read incoming Gmail from, and what it kept.
--
-- Screen 16.2 connects Gmail with a read-only scope. A connected mailbox is
-- not a licence to read all of it: the professional names the people whose
-- incoming mail Whitby may look at, and the sync ignores every other sender.
-- That list is `whitbyos_gmail_context_sources`, and it is the whole consent
-- model — no row, no reading.
--
-- WHAT IS IN HERE
-- 1. `whitbyos_gmail_context_sources` — one allowed sender. A client, a
--    contact or a teammate the workspace already has, or an `external`
--    address typed in by hand for someone who is none of the three.
-- 2. `whitbyos_gmail_extracts` — what a read message left behind.
-- 3. `sync_cursor` on the credentials row, which is Gmail's history id, so the
--    next sync can ask what arrived since last time rather than re-reading a
--    mailbox from the beginning.
--
-- THE BODY IS NOT STORED.
-- An extract keeps the envelope (who, when, which thread), Gmail's own short
-- snippet, and the structured reading of the message — a summary and the facts
-- worth acting on. It does not keep the message. Whitby is answering "what is
-- going on with this client", and the extract answers it; a copy of the mail
-- beside it would be a second mail store with none of Gmail's retention or
-- deletion rules, and the professional's clients did not agree to one.
--
-- Re-runnable: every object is `if not exists`, every policy is dropped by
-- name first, and the file is one transaction, so a failure leaves nothing.

begin;

-- ---------------------------------------------------------------------------
-- 1. Who may be read
--
-- `kind` says where the address came from and `source_id` points back at that
-- row, so a contact renamed in People is still the same permission. `external`
-- has no row to point at, which is why `source_id` is nullable rather than the
-- four kinds being four tables.
--
-- The unique key is the address, not the source. The same person can be a
-- contact on one client and a teammate on another; the question the sync asks
-- is "may I read mail from this address", and that has one answer.
--
-- `client_id` is what an extract is later filed against. Nullable: a teammate
-- or a hand-typed address need not belong to a client.
-- ---------------------------------------------------------------------------

create table if not exists public.whitbyos_gmail_context_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null,
  source_id uuid,
  client_id uuid references public.whitbyos_clients (id) on delete set null,
  email text not null,
  label text not null,
  -- Who allowed them. `set null` rather than cascade: the permission outlives
  -- the person who granted it, and losing a colleague must not silently start
  -- ignoring a client's mail.
  created_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint whitbyos_gmail_context_sources_kind_chk
    check (kind = any (array['client'::text, 'contact'::text, 'team'::text, 'external'::text]))
);

create unique index if not exists whitbyos_gmail_context_sources_email_idx
  on public.whitbyos_gmail_context_sources (workspace_id, email);

create index if not exists whitbyos_gmail_context_sources_workspace_idx
  on public.whitbyos_gmail_context_sources (workspace_id);

-- ---------------------------------------------------------------------------
-- 2. What was read
--
-- Keyed on Gmail's own message id so a sync that overlaps the last one — which
-- every history-id sync does at its boundary — updates the row it already
-- wrote instead of adding a second copy of the same mail.
--
-- `relevant` is the model's verdict, not a filter applied before reading: a
-- message that turned out to say nothing actionable is still a message that
-- was read, and recording it is what stops the next sync paying to read it
-- again. `extracted` holds the facts; `summary` is the sentence for a person.
--
-- Every link out is `on delete set null`. An extract is a note about what
-- arrived, and it stays true after the client, contact or request it mentions
-- has gone.
-- ---------------------------------------------------------------------------

create table if not exists public.whitbyos_gmail_extracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text,
  from_email text not null,
  from_name text,
  subject text,
  snippet text,
  received_at timestamptz,
  source_id uuid references public.whitbyos_gmail_context_sources (id) on delete set null,
  client_id uuid references public.whitbyos_clients (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  request_id uuid references public.whitbyos_requests (id) on delete set null,
  summary text,
  extracted jsonb not null default '{}'::jsonb,
  relevant boolean not null default false,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists whitbyos_gmail_extracts_message_idx
  on public.whitbyos_gmail_extracts (workspace_id, gmail_message_id);

create index if not exists whitbyos_gmail_extracts_workspace_idx
  on public.whitbyos_gmail_extracts (workspace_id, received_at desc);

-- Partial, because the client timeline is the only reader that wants this
-- order and an extract with no client is never on it.
create index if not exists whitbyos_gmail_extracts_client_idx
  on public.whitbyos_gmail_extracts (workspace_id, client_id, received_at desc)
  where client_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Where the sync left off
--
-- Gmail's history id. Additive and nullable: a mailbox that has never synced
-- has none, and the first sync reads a recent window and records one.
-- ---------------------------------------------------------------------------

alter table public.whitbyos_integration_credentials
  add column if not exists sync_cursor text;

-- ---------------------------------------------------------------------------
-- 4. Who can reach it
--
-- `_staff` only. Neither table has a client-facing side: the portal never sees
-- the professional's mail, and an extract about a client is the professional's
-- working note about them, not a document shared with them.
-- ---------------------------------------------------------------------------

alter table public.whitbyos_gmail_context_sources enable row level security;
alter table public.whitbyos_gmail_extracts enable row level security;

drop policy if exists whitbyos_gmail_context_sources_staff on public.whitbyos_gmail_context_sources;
create policy whitbyos_gmail_context_sources_staff on public.whitbyos_gmail_context_sources
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists whitbyos_gmail_extracts_staff on public.whitbyos_gmail_extracts;
create policy whitbyos_gmail_extracts_staff on public.whitbyos_gmail_extracts
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

commit;

-- =====================================================================
-- VERIFY — two tables with RLS on and one _staff policy each, and the
-- cursor column on the credentials row.
-- =====================================================================
-- select c.relname, c.relrowsecurity, p.polname
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- left join pg_policy p on p.polrelid = c.oid
-- where n.nspname = 'public'
--   and c.relname in ('whitbyos_gmail_context_sources', 'whitbyos_gmail_extracts');
--
-- select column_name from information_schema.columns
-- where table_name = 'whitbyos_integration_credentials' and column_name = 'sync_cursor';
