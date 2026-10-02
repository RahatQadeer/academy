-- =====================================================================
-- A client ticking off a task in a Work Plan shared with them.
-- Proposed by: Rohail (client-portal). Owner / sign-off: Sabahat (whitbyos_*).
--
-- WHY THIS EXISTS
--
-- `020` let a client complete a task marked client-visible and nothing else.
-- A Work Plan shared on WP.17v reaches the client through
-- `portal_request_plans()` (013/014/019), and every task in it is listed on the
-- Request's Tasks tab and Overview, most of them without `client_visible` set,
-- because the professional shared the plan rather than ticking each task. So
-- the client could read the plan's tasks, see its progress, and do nothing to
-- move it: a finished task stayed open until somebody in the firm closed it.
--
-- This widens `portal_set_task_done()` by exactly the set
-- `portal_request_plans()` returns: a task in a Work Stream that is not
-- `client_hidden`, of a plan that is shared, not archived, not deleted and not
-- a draft, on a Request this contact can see. Nothing a client cannot already
-- read becomes writable, and the three columns written are the same three.
--
-- DEPENDS ON: 020 (the function this replaces), 013/014 (client_shared_at,
-- client_hidden).
--
-- SAFE TO RUN, and re-runnable. One `create or replace function`.
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

  perform 1
  from public.whitbyos_tasks t
  where t.id = p_task_id
    and (
      -- 020: a client-visible task on a Request they see, or named to them.
      (
        t.visibility = 'client_visible'
        and (
          public.portal_can_see_request(t.request_id)
          or public.portal_is_client_of(t.client_id)
        )
      )
      -- 023: a task in a shared Work Plan, the same test portal_request_plans
      -- applies to decide the client may read it.
      or exists (
        select 1
        from public.whitbyos_workstreams ws
        join public.whitbyos_workplans wp on wp.id = ws.workplan_id
        where ws.id = t.workstream_id
          and ws.client_hidden = false
          and wp.client_shared_at is not null
          and wp.archived_at is null
          and wp.deleted_at is null
          and wp.status <> 'draft'
          and public.portal_can_see_request(wp.request_id)
      )
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
-- As a signed-in client, on a task inside a shared plan on one of their
-- Requests — returns 'complete', and the second call puts it back:
--
-- select public.portal_set_task_done('<plan task id>', true);
-- select public.portal_set_task_done('<plan task id>', false);
--
-- On a task in an unshared plan, or in a client-hidden stream, it must raise
-- "That task is not one you can change".
