-- Client Portal — the people on a conversation, and a thread row for every thread.
-- Owner: Rohail (client_portal_*). Sign-off: Sabahat (whitbyos_*), Laiba (base).
--
-- ADDITIVE. No policy belonging to another module is dropped or modified. The
-- only DROP is on this module's own `portal_start_thread()`, whose signature
-- changes and which has no callers yet.
--
-- WHY THIS EXISTS
--
-- 001 and 003 let a client read the threads they are a participant of and the
-- messages in them. They cannot read a single *name*, so the portal renders
-- every incoming message as the literal string "Your team" and the thread
-- header lists nobody. A conversation with an unnamed counterparty is not a
-- conversation — SRS 13.6 has the client talking to named people.
--
-- The names live in three base tables. A client matches zero rows on all of
-- them: `users_select_teammates` and `companies_select` both test
-- `is_workspace_member()`, and `contacts_select_client` (001) is scoped to the
-- caller's own client account, so the professional who wrote to them is not in
-- it.
--
-- WHY A FUNCTION AND NOT THREE MORE POLICIES
--
-- Same reasoning 003 used for `portal_mark_thread_read()`: RLS grants a whole
-- ROW. `create policy users_select_client ... for select` would hand the client
-- every column of `public.users` — `password_hash`, `phone`, `email`,
-- `oauth_id` — for every professional who has ever written to them. The portal
-- needs one string per person. So one security-definer function returns exactly
-- that string, and the three tables stay unreadable from this side.
--
-- SAFE TO RUN. No DROP TABLE, DROP COLUMN, DELETE or TRUNCATE. Wrapped in an
-- explicit transaction: Postgres DDL is transactional, so a failure anywhere
-- rolls the whole file back.

begin;

-- ---------------------------------------------------------------------------
-- 1. Who is on a conversation
--
-- Returns one row per person per thread, for the threads named that the caller
-- is actually a participant of — `portal_in_thread()` is applied inside, so a
-- caller passing somebody else's thread id gets nothing back.
--
-- Two kinds of person come back, because the portal needs both and they are not
-- the same set:
--
--   `is_participant` — on the thread now. This is the roster the thread header
--   lists, and it includes people who have not said anything yet (a thread can
--   have participants before it has messages — whitbyos/018).
--
--   the rest — authors of messages the caller can read, who are no longer on
--   the thread. Without these a message from someone since removed renders
--   with no author at all.
--
-- History visibility (SRS 13.6.4) is applied to the author half: a client added
-- with `from_added` has no business learning who spoke before they joined from
-- a name they cannot attach to anything. The roster half is deliberately not
-- filtered — that is the current membership of a conversation they are in.
--
-- An email address is never a fallback. WhitbyOS falls back to `users.email`
-- when a teammate has no name set; doing that here would disclose staff email
-- addresses to clients, so the generic label is used instead.
-- ---------------------------------------------------------------------------
create or replace function public.portal_thread_people(p_thread_ids uuid[])
returns table (
  thread_id uuid,
  party_type text,
  party_id uuid,
  display_name text,
  is_participant boolean
)
language sql stable security definer set search_path = public as $$
  with mine as (
    select t.id
    from unnest(coalesce(p_thread_ids, '{}'::uuid[])) as t(id)
    where public.portal_in_thread(t.id)
  ),
  parties as (
    select mp.thread_id, mp.participant_type as party_type,
           mp.participant_id as party_id, true as is_participant
    from public.whitbyos_message_participants mp
    join mine on mine.id = mp.thread_id
    where mp.removed_at is null

    union

    select m.thread_id, m.sender_type, m.sender_id, false
    from public.whitbyos_messages m
    join mine on mine.id = m.thread_id
    where m.status = 'sent'
      and (
        public.portal_thread_history_from(m.thread_id) is null
        or m.created_at >= public.portal_thread_history_from(m.thread_id)
      )
  ),
  merged as (
    -- A person on the thread who has also written to it arrives once from each
    -- branch of the union; the roster fact is the one that matters.
    --
    -- Every reference below is qualified. `returns table` puts `thread_id`,
    -- `party_type` and `party_id` in scope as output parameters, so a bare
    -- column of the same name is ambiguous and the function will not compile.
    select pa.thread_id, pa.party_type, pa.party_id,
           bool_or(pa.is_participant) as is_participant
    from parties pa
    group by pa.thread_id, pa.party_type, pa.party_id
  )
  select p.thread_id,
         p.party_type,
         p.party_id,
         case p.party_type
           when 'user' then coalesce(
             nullif(btrim(u.preferred_name), ''),
             nullif(btrim(u.full_name), ''),
             'Your team'
           )
           when 'contact' then coalesce(
             nullif(btrim(c.preferred_name), ''),
             nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
             'Member'
           )
           when 'company' then coalesce(nullif(btrim(co.name), ''), 'Provider')
           else 'Unknown'
         end as display_name,
         p.is_participant
    from merged p
    left join public.users u on p.party_type = 'user' and u.id = p.party_id
    left join public.contacts c on p.party_type = 'contact' and c.id = p.party_id
    left join public.companies co on p.party_type = 'company' and co.id = p.party_id;
$$;

revoke all on function public.portal_thread_people(uuid[]) from public, anon;
grant execute on function public.portal_thread_people(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. A thread started from the portal is a real thread
--
-- `portal_start_thread()` (001) predates whitbyos/014, when a thread stopped
-- being "the messages sharing this id" and became a row of its own. It still
-- invents a `thread_id`, writes a participant and a message against it, and
-- never inserts the `whitbyos_message_threads` row — so a conversation a client
-- starts is invisible to the professional, whose inbox lists FROM that table
-- (whitbyos/lib/messages.ts `listThreads`), and has no subject on either side.
--
-- The function has no callers yet, so the signature is corrected rather than
-- extended: a thread needs a subject, and `subject` is NOT NULL on the table.
--
-- `kind` is 'direct'. Staff choose between direct and group when they pick
-- recipients; a client-started thread has exactly one participant until the
-- workspace adds to it.
-- ---------------------------------------------------------------------------
drop function if exists public.portal_start_thread(text, uuid);

create or replace function public.portal_start_thread(
  p_subject text,
  p_body text,
  p_request_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_contact uuid := public.portal_contact_id();
  v_client uuid;
  v_workspace uuid;
  v_thread uuid;
  v_now timestamptz := now();
begin
  if v_contact is null then
    raise exception 'No client portal identity for this account';
  end if;
  if coalesce(btrim(p_subject), '') = '' then
    raise exception 'A subject is required';
  end if;
  if coalesce(btrim(p_body), '') = '' then
    raise exception 'A message is required';
  end if;

  select c.id, c.workspace_id into v_client, v_workspace
  from public.whitbyos_clients c
  where c.id in (select public.portal_client_ids())
  limit 1;

  if v_client is null then
    raise exception 'This account is not linked to a client';
  end if;

  if p_request_id is not null and not public.portal_request_client_ok(p_request_id) then
    raise exception 'That request is not available to this account';
  end if;

  insert into public.whitbyos_message_threads
    (workspace_id, subject, kind, request_id, client_id, last_message_at)
  values
    (v_workspace, btrim(p_subject), 'direct', p_request_id, v_client, v_now)
  returning id into v_thread;

  insert into public.whitbyos_message_participants
    (thread_id, participant_type, participant_id, history_visibility)
  values
    (v_thread, 'contact', v_contact, 'full');

  insert into public.whitbyos_messages
    (workspace_id, thread_id, request_id, client_id, sender_type, sender_id,
     body, status, source, created_at)
  values
    (v_workspace, v_thread, p_request_id, v_client, 'contact', v_contact,
     btrim(p_body), 'sent', 'native', v_now);

  return v_thread;
end;
$$;

revoke all on function public.portal_start_thread(text, text, uuid) from public, anon;
grant execute on function public.portal_start_thread(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. A client's reply moves the thread up the professional's inbox
--
-- FOR SABAHAT — this section is the one thing here that changes behaviour on the
-- WhitbyOS side, and it is proposed rather than assumed. Move it to
-- whitbyos/migrations if you would rather own it; the portal needs the effect,
-- not the authorship.
--
-- `whitbyos_message_threads.last_message_at` is what the professional's inbox
-- orders by, and nothing in the database maintains it — it is set by hand in
-- whitbyos/messages/actions.ts when a professional sends. The portal cannot do
-- the same: it has no update policy on that table (003 grants select only), and
-- giving it one would hand a client every other column on the thread row.
--
-- So a client's reply currently lands in the thread and leaves it sitting where
-- it was in the inbox, below conversations with nothing new in them.
--
-- A trigger fixes it for both sides at once and removes the chance of the next
-- write path forgetting. It only ever moves the timestamp FORWARD, so it cannot
-- fight the explicit writes already in the WhitbyOS action.
-- ---------------------------------------------------------------------------
create or replace function public.whitbyos_thread_touch_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sent' then
    update public.whitbyos_message_threads
       set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
     where id = new.thread_id;
  end if;
  return new;
end;
$$;

-- `update of status` as well as insert: a draft becomes a message by having its
-- status changed, which is how WhitbyOS sends one it autosaved. `new.created_at`
-- is the right timestamp on both paths — the send in whitbyos/messages/actions.ts
-- resets `created_at` to the send time rather than leaving it at the moment the
-- draft was first autosaved.
drop trigger if exists whitbyos_messages_touch_thread on public.whitbyos_messages;

create trigger whitbyos_messages_touch_thread
  after insert or update of status on public.whitbyos_messages
  for each row execute function public.whitbyos_thread_touch_last_message();

-- ---------------------------------------------------------------------------
-- 4. Realtime
--
-- Shared with whitbyos/016, which adds the same two tables to the same
-- publication. Repeated here, guarded, so an environment that has this file but
-- not that one still delivers live messages to the portal rather than silently
-- requiring a page reload. Adding a table already in a publication is an error,
-- not a no-op, hence the existence test.
--
-- RLS applies to realtime rows exactly as it does to a query: a client is sent
-- only the messages 001's select policy would already have given them.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whitbyos_messages'
  ) then
    alter publication supabase_realtime add table public.whitbyos_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whitbyos_message_threads'
  ) then
    alter publication supabase_realtime add table public.whitbyos_message_threads;
  end if;
end
$$;

commit;

-- VERIFY
-- select proname, pronargs from pg_proc
--   where proname in ('portal_thread_people', 'portal_start_thread',
--                     'whitbyos_thread_touch_last_message');
-- select tgname from pg_trigger where tgname = 'whitbyos_messages_touch_thread';
-- select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' and tablename like 'whitbyos_message%';
--
-- As a signed-in client, both should return their own threads' people and nothing else:
--   select * from public.portal_thread_people(array(select thread_id
--     from public.whitbyos_message_participants
--     where participant_id = public.portal_contact_id()));
--   select * from public.portal_thread_people(array['00000000-0000-0000-0000-000000000000'::uuid]);
