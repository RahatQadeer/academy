-- =====================================================================
-- Whitby — a Message thread is a record, not just a shared id
-- Owner: Sabahat (whitbyos_*)
--
-- `whitbyos_messages` has a `thread_id uuid` that nothing references. A thread
-- exists only as "the messages that happen to share this value", so it has no
-- subject, no read state, and no way to be a group rather than a direct
-- conversation. Screens 9 through 9.5 need all three:
--
--   9      subject line per thread, and unread threads in bold
--   9.0a   an Unread filter with a count
--   9.0c   a Drafts filter
--   9.3–9.5  a Group tab, separate from Direct
--
-- So the thread becomes a row. Its id is the same `thread_id` the messages
-- already carry, which is why no message data has to move.
--
-- Read state goes on the participant rather than the thread: §7.1.5 permissions
-- Team Tasks per person, and the same holds here — a thread three people can
-- see is unread for whoever has not opened it, not for all of them at once.
-- `whitbyos_message_participants` is where a person already meets a thread.
--
-- Drafts are a status on the message. A draft is the same object as what it
-- becomes when sent — same thread, same recipients, same body — and splitting
-- it into a second table would mean copying it across on send and losing the
-- history that it was written earlier.
--
-- Safe to re-run.
-- =====================================================================

create table if not exists public.whitbyos_message_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subject text not null,
  kind text not null default 'direct',
  request_id uuid references public.whitbyos_requests (id) on delete set null,
  client_id uuid references public.whitbyos_clients (id) on delete set null,
  last_message_at timestamptz,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

alter table public.whitbyos_message_threads
  drop constraint if exists whitbyos_message_threads_kind_check;
alter table public.whitbyos_message_threads
  add constraint whitbyos_message_threads_kind_check
  check (kind in ('direct', 'group'));

create index if not exists whitbyos_message_threads_workspace_idx
  on public.whitbyos_message_threads (workspace_id, last_message_at desc);

-- ---- Drafts ------------------------------------------------------------

alter table public.whitbyos_messages
  add column if not exists status text not null default 'sent';

alter table public.whitbyos_messages
  drop constraint if exists whitbyos_messages_status_check;
alter table public.whitbyos_messages
  add constraint whitbyos_messages_status_check
  check (status in ('draft', 'sent'));

-- ---- Read state, per person --------------------------------------------

alter table public.whitbyos_message_participants
  add column if not exists last_read_at timestamptz;

-- ---- RLS ---------------------------------------------------------------

alter table public.whitbyos_message_threads enable row level security;

drop policy if exists whitbyos_message_threads_staff on public.whitbyos_message_threads;
create policy whitbyos_message_threads_staff on public.whitbyos_message_threads
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));


-- =====================================================================
-- VERIFY — the table, the status column, and the read column
-- =====================================================================
-- select 'thread table' as what, count(*)::text as n from public.whitbyos_message_threads
-- union all
-- select 'messages.status', count(*)::text from information_schema.columns
--   where table_name = 'whitbyos_messages' and column_name = 'status'
-- union all
-- select 'participants.last_read_at', count(*)::text from information_schema.columns
--   where table_name = 'whitbyos_message_participants' and column_name = 'last_read_at';
