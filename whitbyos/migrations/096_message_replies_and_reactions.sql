-- Replying to one message, and reacting to one.
--
-- Two things a chat has that this one did not. A reply that does not say what
-- it is answering is a reply nobody can follow three messages later, and a
-- thumb is how people answer when there is nothing to add — without one,
-- "noted" is sent as a message and the conversation fills with acknowledgement.
--
-- Both are per message rather than per thread, which is why neither could be
-- expressed by anything already here.

-- ---------------------------------------------------------------------------
-- 1. What a message is answering
-- ---------------------------------------------------------------------------

-- Null is the ordinary case: most messages answer the conversation rather than
-- one line of it. `on delete set null` because a deleted message must not take
-- the answer to it away — the reply stands, it just stops quoting.
alter table public.whitbyos_messages
  add column if not exists reply_to_message_id uuid
    references public.whitbyos_messages (id) on delete set null;

create index if not exists whitbyos_messages_reply_to_idx
  on public.whitbyos_messages (reply_to_message_id)
  where reply_to_message_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Reactions
-- ---------------------------------------------------------------------------

-- `workspace_id` is carried rather than joined for, because every policy in
-- this schema is written against it and a reaction has to be readable by the
-- same rule as the message it is on.
--
-- The reactor is a type and an id, the way participants and senders are: a
-- professional is a user, a client contact is a contact, and both react.
create table if not exists public.whitbyos_message_reactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  message_id uuid not null references public.whitbyos_messages (id) on delete cascade,
  thread_id uuid not null,
  reactor_type text not null,
  reactor_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now()
);

-- One person, one of each emoji, on one message — a second tap takes it off
-- rather than counting twice, and the constraint is what makes that true
-- whatever the application does.
create unique index if not exists whitbyos_message_reactions_once_idx
  on public.whitbyos_message_reactions (message_id, reactor_type, reactor_id, emoji);

create index if not exists whitbyos_message_reactions_message_idx
  on public.whitbyos_message_reactions (message_id);

alter table public.whitbyos_message_reactions enable row level security;

-- The professional's side: the same rule `whitbyos_messages_all` is written
-- with, so anybody who can read the message can read what was put on it.
drop policy if exists whitbyos_message_reactions_all on public.whitbyos_message_reactions;
create policy whitbyos_message_reactions_all on public.whitbyos_message_reactions
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- The client's side, kept in step with `whitbyos_messages_select_client`: a
-- reaction is readable when the thread is theirs, and they may only put on and
-- take off their own.
drop policy if exists whitbyos_message_reactions_select_client
  on public.whitbyos_message_reactions;
create policy whitbyos_message_reactions_select_client
  on public.whitbyos_message_reactions
  for select using (public.portal_in_thread(thread_id));

drop policy if exists whitbyos_message_reactions_insert_client
  on public.whitbyos_message_reactions;
create policy whitbyos_message_reactions_insert_client
  on public.whitbyos_message_reactions
  for insert with check (
    public.portal_in_thread(thread_id)
    and reactor_type = 'contact'
    and reactor_id = public.portal_contact_id()
  );

drop policy if exists whitbyos_message_reactions_delete_client
  on public.whitbyos_message_reactions;
create policy whitbyos_message_reactions_delete_client
  on public.whitbyos_message_reactions
  for delete using (
    public.portal_in_thread(thread_id)
    and reactor_type = 'contact'
    and reactor_id = public.portal_contact_id()
  );

-- Live, like messages: a reaction that arrives on a reload is a reaction
-- nobody sees, and the conversation is already subscribed to this schema.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.whitbyos_message_reactions;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;
