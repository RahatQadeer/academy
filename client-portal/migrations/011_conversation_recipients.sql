-- Who a client is starting a conversation with.
-- Owner: Rohail (client_portal_*). Sign-off: Sabahat (whitbyos_*).
--
-- SAFE TO RUN, AND SAFE TO RUN TWICE. The only statements here are
-- `drop function if exists` and `create or replace function`. No table is
-- created, altered or dropped, no policy is added or removed, and no row is
-- written. Re-running it replaces two function bodies with the same two
-- function bodies.
--
-- WHY THIS EXISTS
-- `004` gave `portal_start_thread` a subject and a thread row, and seeded the
-- thread with exactly one participant: the client who started it. That is the
-- right shape for the only conversation the portal could start at the time —
-- one aimed at the professional's shared inbox, which every teammate sees
-- (`listThreads` in whitbyos/lib/messages.ts reads every thread in the
-- workspace), and which whoever picks it up joins by adding themselves.
--
-- It is the wrong shape for the other conversation a client now has reason to
-- start. An account can carry several people — a spouse, an assistant, an adult
-- child — each with their own login, and until now a client had no way to say
-- which of them a conversation was for. The screen could not ask, because the
-- function had nowhere to put the answer.
--
-- WHAT A RECIPIENT IS, AND IS NOT
-- `p_recipient_contact_id` names a second *contact* seat on the thread. Null
-- keeps 004's behaviour exactly — no second participant, and the thread reaches
-- the professional's team the way every client-started thread has.
--
-- It is not a privacy boundary. A thread naming another member is still a thread
-- in the workspace, and the professional's inbox lists every one of them. The
-- portal says so on the screen that offers this, and that sentence is load
-- bearing: a client who believes they are writing privately to their spouse, on
-- an account their advisers read, has been misled by the software rather than
-- by anyone's intent. If that ever needs to become a real boundary, it is
-- `listThreads` and a policy on `whitbyos_message_threads` that decide it, not
-- this function.
--
-- WHY NO NEW POLICY IS NEEDED
-- The recipient reaches the thread through `001`'s existing policies. A contact
-- with a participant row satisfies `portal_in_thread()`, which is what
-- `whitbyos_messages_select_client` and `_insert_client` already key on. So the
-- person named here can read the thread and reply to it the moment the row
-- exists, with nothing further granted.

begin;

-- ---------------------------------------------------------------------------
-- 1. Who this client is allowed to name
--
-- Separate from the write below so the portal can ask the same question the
-- function will answer, and offer exactly the people who would be accepted —
-- rather than drawing a list the write then rejects.
--
-- Three conditions, and each one is a way of being wrong:
--
--   * A member of the same client account. Naming a contact from another
--     account would seat a stranger on the thread.
--   * `portal_access` — someone with no login cannot be written to. A dependent
--     is a record on the account, not a correspondent.
--   * Not the caller. A conversation with yourself is not one.
--
-- Deliberately not filtered on the Messages *area* grant. That is a live
-- permission the professional can change after the thread exists, and a thread
-- whose recipient later loses Messages should stop being readable by them —
-- which `001`'s policies already handle — rather than having been impossible to
-- create. The portal filters its picker on the area; this is the floor, not the
-- courtesy.
-- ---------------------------------------------------------------------------
create or replace function public.portal_messageable_contact_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.contact_id
  from public.whitbyos_client_members m
  where m.client_id in (select public.portal_client_ids())
    and m.portal_access is true
    and m.contact_id is distinct from public.portal_contact_id();
$$;

revoke all on function public.portal_messageable_contact_ids() from public, anon;
grant execute on function public.portal_messageable_contact_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The write
--
-- `drop` then `create`, not `create or replace`: adding a parameter makes a new
-- signature rather than replacing the old one, and leaving both in place gives
-- PostgREST two candidates for the same name and an ambiguous-function error
-- (PGRST203) on every call. Same reasoning as 004's own drop of the two-argument
-- version, and the same consequence if it is skipped.
--
-- The default on the new parameter is what lets an unchanged three-argument call
-- keep working, so the "message my team" path is untouched by this file.
-- ---------------------------------------------------------------------------
drop function if exists public.portal_start_thread(text, text, uuid);

create or replace function public.portal_start_thread(
  p_subject text,
  p_body text,
  p_request_id uuid default null,
  p_recipient_contact_id uuid default null
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

  -- Checked here and not only on the screen. The screen renders what was true
  -- when the page loaded; this runs at the moment of the write, and it is the
  -- one that decides. A recipient removed from the account between the two is
  -- refused here.
  if p_recipient_contact_id is not null
     and p_recipient_contact_id not in (select public.portal_messageable_contact_ids())
  then
    raise exception 'That person is not on this account';
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

  -- 'full' rather than 'from_added': the thread is one message old and that
  -- message is addressed to them. There is no history here to withhold, and
  -- `portal_thread_history_from` would otherwise hide the opening message from
  -- the person it was written for.
  if p_recipient_contact_id is not null then
    insert into public.whitbyos_message_participants
      (thread_id, participant_type, participant_id, history_visibility)
    values
      (v_thread, 'contact', p_recipient_contact_id, 'full');
  end if;

  insert into public.whitbyos_messages
    (workspace_id, thread_id, request_id, client_id, sender_type, sender_id,
     body, status, source, created_at)
  values
    (v_workspace, v_thread, p_request_id, v_client, 'contact', v_contact,
     btrim(p_body), 'sent', 'native', v_now);

  return v_thread;
end;
$$;

revoke all on function public.portal_start_thread(text, text, uuid, uuid) from public, anon;
grant execute on function public.portal_start_thread(text, text, uuid, uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Verification
--
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'portal_start_thread';
--
-- Expected: exactly one row, taking (text, text, uuid, uuid). Two rows means the
-- drop above did not match the signature actually installed, and PostgREST will
-- answer PGRST203 until one of them is removed.
-- ---------------------------------------------------------------------------
