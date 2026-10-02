-- =====================================================================
-- Whitby — Ask Whitby keeps a conversation
-- Owner: Sabahat (whitbyos_*)
--
-- Ask Whitby was one GET and a forgotten answer. A follow-up started from
-- nothing, there was no way back to what was asked yesterday, and nothing
-- to delete. These two tables are the chat: a thread per professional in a
-- workspace, and the turns inside it, including an optional image they
-- attached to a question.
--
-- Personal, not a team inbox. Messages already holds the firm's
-- conversations; this is one person's Ask history, the way a chat client
-- keeps yours and nobody else's.
--
-- Safe to re-run.
-- =====================================================================

create table if not exists public.whitbyos_ask_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  client_id uuid references public.whitbyos_clients (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whitbyos_ask_threads_mine_idx
  on public.whitbyos_ask_threads (workspace_id, user_id, updated_at desc);

create table if not exists public.whitbyos_ask_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.whitbyos_ask_threads (id) on delete cascade,
  role text not null,
  body text not null default '',
  answer jsonb,
  image_path text,
  created_at timestamptz not null default now()
);

alter table public.whitbyos_ask_messages
  drop constraint if exists whitbyos_ask_messages_role_check;
alter table public.whitbyos_ask_messages
  add constraint whitbyos_ask_messages_role_check
  check (role in ('user', 'whitby'));

create index if not exists whitbyos_ask_messages_thread_idx
  on public.whitbyos_ask_messages (thread_id, created_at);

alter table public.whitbyos_ask_threads enable row level security;
alter table public.whitbyos_ask_messages enable row level security;

drop policy if exists whitbyos_ask_threads_staff on public.whitbyos_ask_threads;
create policy whitbyos_ask_threads_staff on public.whitbyos_ask_threads
  for all
  using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
  with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists whitbyos_ask_messages_staff on public.whitbyos_ask_messages;
create policy whitbyos_ask_messages_staff on public.whitbyos_ask_messages
  for all
  using (
    exists (
      select 1
      from public.whitbyos_ask_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
        and public.is_workspace_member(t.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.whitbyos_ask_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
        and public.is_workspace_member(t.workspace_id)
    )
  );

grant select, insert, update, delete on public.whitbyos_ask_threads to authenticated;
grant select, insert, update, delete on public.whitbyos_ask_messages to authenticated;
