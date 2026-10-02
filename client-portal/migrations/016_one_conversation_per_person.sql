-- Portal 016 — a client writing again lands in the conversation they already have
--
-- `portal_start_thread` inserts a thread every time it is called, so a client
-- who used "New conversation" twice had two conversations with the same team,
-- and the professional's inbox listed the same person twice over.
--
-- WhitbyOS has never done that: `startDirect` looks for an existing direct
-- thread with that person and opens it instead. This is the same rule, from the
-- other end — wherever a message comes from, it belongs in the one conversation
-- those people already have.
--
-- Matching is on who is on it, not on what it is called. A direct thread in this
-- workspace whose live contact participants are exactly the people this message
-- is between is that conversation, whatever subject either side gave it and
-- whoever from the firm has since been written onto it.
--
-- Two things are deliberately left alone when a thread is reused. Its subject,
-- because the name of a conversation is not re-decided every time somebody
-- writes in it. And its Request, because the professional may have tied it to
-- one — the *message* still carries `p_request_id`, which is what the Request's
-- own screens read.

begin;

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
  v_people uuid[];
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

  -- Who this conversation is between, on the client's side of it. A thread
  -- addressed to the firm is between one person and the team; one addressed to
  -- somebody on the account is between two.
  v_people := case
    when p_recipient_contact_id is null then array[v_contact]
    else array[v_contact, p_recipient_contact_id]
  end;

  -- The conversation these people already have, newest first — a workspace
  -- should never hold two, but if it somehow does, the live one is the one
  -- they are reading.
  select t.id into v_thread
    from public.whitbyos_message_threads t
   where t.workspace_id = v_workspace
     and t.kind = 'direct'
     and (
       select coalesce(array_agg(p.participant_id order by p.participant_id), '{}'::uuid[])
         from (
           select distinct p.participant_id
             from public.whitbyos_message_participants p
            where p.thread_id = t.id
              and p.removed_at is null
              and p.participant_type = 'contact'
         ) p
     ) = (select coalesce(array_agg(x order by x), '{}'::uuid[])
            from (select distinct unnest(v_people) as x) s)
   order by t.last_message_at desc nulls last, t.created_at desc
   limit 1;

  if v_thread is null then
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
--   select t.id, t.subject, count(m.id)
--   from public.whitbyos_message_threads t
--   left join public.whitbyos_messages m on m.thread_id = t.id
--   where t.kind = 'direct'
--   group by t.id, t.subject;
--
-- Starting a conversation from the portal with somebody a thread already exists
-- with should leave the count of threads where it was and add one message.
-- ---------------------------------------------------------------------------
