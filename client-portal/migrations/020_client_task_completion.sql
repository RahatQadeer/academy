-- =====================================================================
-- A client ticking off their own task.
-- Proposed by: Rohail (client-portal). Owner / sign-off: Sabahat (whitbyos_*).
--
-- WHY THIS EXISTS
--
-- `005` gave a client the read of a client-visible Task and nothing else.
-- `whitbyos_tasks` has exactly two policies after it: `whitbyos_tasks_all`,
-- scoped to workspace members, and `whitbyos_tasks_select_client`, which is a
-- SELECT. So a client looking at a task they were asked to do — "send us the
-- signed lease", sitting on /client-portal/tasks with a tick beside it — had no
-- way to say they had done it. Only the professional could, from Whitby's own
-- 7.1, and the client's half of the conversation was a message asking them to.
--
-- This is the write half, and it is deliberately not a policy. An UPDATE policy
-- on `whitbyos_tasks` would hand the client every column of the row: the title,
-- the owner, the due date, the visibility that decides whether they can see it
-- at all. One definer function, taking a task and a boolean, is the whole of
-- what they may change.
--
-- WHAT IT CHANGES, AND NOTHING ELSE
--
--   status        'complete' or, undoing it, 'in_progress'
--   completed_at  now() on completing, null on undoing
--   updated_at    now()
--
-- The same three `whitbyos/tasks/actions.ts::completeTask` writes, in the same
-- shape, through `completionStamp`'s rule: an existing stamp is kept, because
-- editing a finished task should not move the day it was finished, and only
-- reopening clears it — a completion that was undone did not happen.
--
-- Reopening lands on 'in_progress' rather than on whatever the status was
-- before, which is what Whitby's own Mark Complete button does when it undoes
-- itself. A task the firm had parked as `waiting` and then completed comes back
-- as in progress, not as waiting: the client has just said they are working on
-- it, and the firm's own screen is where a wait is re-declared.
--
-- WHO MAY CALL IT
--
-- Exactly the tasks `005` lets this contact read: `visibility = 'client_visible'`
-- and either a Request they can see or their own client account named on the
-- row. A task that fails that test raises rather than returning quietly, so the
-- portal can tell the client their access changed instead of drawing a tick
-- that did nothing.
--
-- A view-only member is refused in the application (`requireWrite`), not here.
-- `permissions` lives in `whitbyos_client_members.permissions` and is the
-- portal's own access model; this function's job is the database's question —
-- is this task one of yours — and answering both in one place would mean two
-- owners for one rule.
--
-- DEPENDS ON: 001 (portal_contact_id, portal_is_client_of,
-- portal_can_see_request), 005 (the read this write is the other half of),
-- whitbyos/037 (tasks.completed_at), whitbyos/044 (tasks.client_id).
--
-- The portal degrades without this file: the action reports that the change
-- could not be saved, and the rest of the screen is unaffected.
--
-- SAFE TO RUN, and re-runnable. One `create or replace function`, no DROP,
-- DELETE or TRUNCATE, no policy belonging to another module touched.
-- =====================================================================

begin;

create or replace function public.portal_set_task_done(
  p_task_id uuid,
  p_done boolean
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if public.portal_contact_id() is null then
    raise exception 'No client portal identity for this account';
  end if;

  -- The same test `whitbyos_tasks_select_client` applies, spelled out rather
  -- than leaned on: this function is SECURITY DEFINER, so the policy does not
  -- run for it and the check has to be its own.
  perform 1
  from public.whitbyos_tasks t
  where t.id = p_task_id
    and t.visibility = 'client_visible'
    and (
      public.portal_can_see_request(t.request_id)
      or public.portal_is_client_of(t.client_id)
    );

  if not found then
    raise exception 'That task is not one you can change';
  end if;

  update public.whitbyos_tasks t
  set status = case when p_done then 'complete' else 'in_progress' end,
      completed_at = case when p_done then coalesce(t.completed_at, now()) else null end,
      updated_at = now()
  where t.id = p_task_id
  returning t.status into v_status;

  return v_status;
end;
$$;

revoke all on function public.portal_set_task_done(uuid, boolean) from public;
grant execute on function public.portal_set_task_done(uuid, boolean) to authenticated;

commit;

-- VERIFY
--
-- The function exists and is definer:
--
-- select proname, prosecdef from pg_proc where proname = 'portal_set_task_done';
--
-- As a signed-in client, on a task of theirs — returns 'complete', and the
-- second call puts it back:
--
-- select public.portal_set_task_done('<task id>', true);
-- select public.portal_set_task_done('<task id>', false);
--
-- On somebody else's task, or an internal one, it must raise
-- "That task is not one you can change" rather than return null.
