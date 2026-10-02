-- A conversation must be able to have people in it before it has anything said.
--
-- The staff policy on `whitbyos_message_participants` decides what you may
-- touch by looking for a MESSAGE in the same thread that belongs to a workspace
-- you are in:
--
--   using ( exists (select 1 from whitbyos_messages m
--                   where m.thread_id = ... and is_workspace_member(m.workspace_id)) )
--
-- and with no `with check`, that expression governs inserts too. So the first
-- participant on a brand-new thread cannot be written: there is no message in
-- it yet, and there will not be one until someone is on it to send it.
--
-- Nothing errored visibly. Starting a conversation produced a thread with zero
-- participants — nameless in the list, unfindable when the same person is
-- picked again (so a second empty thread appears), and with no recipient
-- recorded against anything sent into it.
--
-- The policy predates 014, when a thread was only "the messages sharing this
-- id" and its messages really were the only way to place it. A thread is a row
-- now and carries its own workspace_id, so that is what decides this. The old
-- message-based test is kept as an alternative for any thread from before 014
-- that has no row of its own.

drop policy if exists whitbyos_message_participants_staff
  on public.whitbyos_message_participants;

create policy whitbyos_message_participants_staff
  on public.whitbyos_message_participants
  for all
  using (
    exists (
      select 1 from public.whitbyos_message_threads t
       where t.id = whitbyos_message_participants.thread_id
         and public.is_workspace_member(t.workspace_id)
    )
    or exists (
      select 1 from public.whitbyos_messages m
       where m.thread_id = whitbyos_message_participants.thread_id
         and public.is_workspace_member(m.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.whitbyos_message_threads t
       where t.id = whitbyos_message_participants.thread_id
         and public.is_workspace_member(t.workspace_id)
    )
    or exists (
      select 1 from public.whitbyos_messages m
       where m.thread_id = whitbyos_message_participants.thread_id
         and public.is_workspace_member(m.workspace_id)
    )
  );
