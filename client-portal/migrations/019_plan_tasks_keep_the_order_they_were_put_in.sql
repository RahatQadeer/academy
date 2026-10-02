-- =====================================================================
-- A shared Work Plan reads in the order the professional arranged it.
-- Proposed by: Rohail (client-portal). Owner / sign-off: Sabahat (whitbyos_*).
--
-- whitbyos/091 gave a task a `sort_order`, so the tasks in a Work Stream keep
-- the order somebody dragged them into. `whitbyos/lib/work-plans.ts` reads
-- them `order by sort_order nulls last, created_at`.
--
-- 014's mirror still orders a stream's tasks by `created_at` alone, under a
-- comment saying that is what Whitby does — true when it was written, and not
-- true since 091. So a professional arranges a plan, shares it, and the client
-- opens the same plan with its tasks in the order they were drafted: the two
-- sides of one Work Plan disagree about what comes first.
--
-- Nothing else about the mirror changes. `sort_order` is not returned — the
-- client is given the order, not the number behind it — and the list of what
-- is never returned in 014 stands unchanged.
--
-- DEPENDS ON: 013, 014, whitbyos/091.
--
-- Safe to re-run.
-- =====================================================================

begin;

create or replace function public.portal_request_plans(p_request_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with shared as (
    select wp.id, wp.name, wp.desired_outcome, wp.status, wp.urgency, wp.health,
           wp.start_date, wp.target_date, wp.created_at, wp.updated_at,
           wp.client_shared_at, wp.owner_user_id
    from public.whitbyos_workplans wp
    where wp.request_id = p_request_id
      and public.portal_can_see_request(p_request_id)
      and wp.client_shared_at is not null
      and wp.archived_at is null
      and wp.deleted_at is null
      and wp.status <> 'draft'
  ),
  streams as (
    select ws.id, ws.workplan_id, ws.name, ws.purpose, ws.status, ws.kind, ws.blocked,
           ws.target_date, ws.sort_order, ws.created_at, ws.owner_user_id
    from public.whitbyos_workstreams ws
    where ws.workplan_id in (select s.id from shared s)
      and ws.client_hidden = false
  ),
  tasks as (
    -- `sort_order` joins the columns read here so the mirror can order by it.
    -- It is not put into the JSON: the client is given the arrangement, not
    -- the float that encodes it.
    select t.id, t.workstream_id, t.title, t.status, t.kind, t.due_date,
           t.completed_at, t.created_at, t.sort_order, t.owner_user_id,
           nullif(btrim(coalesce(t.waiting_state, '')), '') is not null as waiting
    from public.whitbyos_tasks t
    where t.workstream_id in (select st.id from streams st)
  ),
  people as (
    select u.id,
           coalesce(nullif(btrim(u.preferred_name), ''),
                    nullif(btrim(u.full_name), ''),
                    'Your team') as name
    from public.users u
    where u.id in (
      select s.owner_user_id from shared s
      union select st.owner_user_id from streams st
      union select tk.owner_user_id from tasks tk
    )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'desiredOutcome', p.desired_outcome,
        'status', p.status,
        'urgency', p.urgency,
        'health', p.health,
        'startDate', p.start_date,
        'targetDate', p.target_date,
        'createdAt', p.created_at,
        'updatedAt', p.updated_at,
        'sharedAt', p.client_shared_at,
        'ownerName', (select pe.name from people pe where pe.id = p.owner_user_id),
        'streams', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', st.id,
              'name', st.name,
              'purpose', st.purpose,
              'status', st.status,
              'kind', st.kind,
              'blocked', st.blocked,
              'targetDate', st.target_date,
              'createdAt', st.created_at,
              'ownerName', (select pe.name from people pe where pe.id = st.owner_user_id),
              'tasks', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', tk.id,
                    'title', tk.title,
                    'status', tk.status,
                    'kind', tk.kind,
                    'dueAt', tk.due_date,
                    'completedAt', tk.completed_at,
                    'createdAt', tk.created_at,
                    'waiting', tk.waiting,
                    'ownerName', (select pe.name from people pe where pe.id = tk.owner_user_id)
                  )
                  -- whitbyos/091, and the same order `getWorkPlan` reads:
                  -- where somebody has placed a task by hand that is the
                  -- order, and the rest keep the order they were drafted in.
                  order by tk.sort_order asc nulls last, tk.created_at
                )
                from tasks tk
                where tk.workstream_id = st.id
              ), '[]'::jsonb)
            )
            order by st.sort_order, st.created_at
          )
          from streams st
          where st.workplan_id = p.id
        ), '[]'::jsonb)
      )
      order by p.client_shared_at
    ),
    '[]'::jsonb
  )
  from shared p;
$$;

revoke all on function public.portal_request_plans(uuid) from public, anon;
grant execute on function public.portal_request_plans(uuid) to authenticated;

commit;

-- =====================================================================
-- VERIFY — a stream's tasks come back in the arranged order.
-- =====================================================================
-- select jsonb_path_query_array(
--          public.portal_request_plans('<request-id>'::uuid),
--          '$[0].streams[0].tasks[*].title')
-- from public.whitbyos_requests limit 1;
