-- =====================================================================
-- A shared Work Plan in full, and the rest of a Request a client may see.
-- Proposed by: Rohail (client-portal). Owner / sign-off: Sabahat (whitbyos_*).
--
-- 013 shared a plan as a summary: each stream with a percentage, and only the
-- tasks marked client-visible. That cannot draw the professional's own six
-- views — List, Table, Grid, Kanban, Timeline, Charts. A Kanban of three tasks
-- out of forty is not the plan, and the charts had nothing to count.
--
-- The product decision, recorded 2026-09-14: sharing a plan shares its work.
-- Once a professional ticks "Share this Work Plan with the client" (WP.17v),
-- the client sees every task in every stream that is not hidden, with its
-- status, its dates, its kind, and the name of the team member who owns it.
--
-- STILL NEVER RETURNED, WHATEVER IS TICKED
--
--   priorities, next actions, checklists, dependencies, completion evidence,
--   what a task is waiting on (only *that* it is waiting), Considerations,
--   providers, worksheets, versions, the source Playbook, and anything about a
--   team member beyond their display name — no email, no photo, no id.
--
-- 013's gates stand unchanged: nothing for a Request the reader cannot see
-- (portal_can_see_request, 001), nothing for a draft, an archived or a deleted
-- plan, and nothing from a stream marked client_hidden.
--
-- `portal_request_detail()` is new. Whitby's Request screens (3.3o, 3.3n,
-- 3.3t) show the Request's owner, the people on it, its notes, and who owns
-- each task. A client can read none of `users`, `whitbyos_notes` or the owner
-- of a task, and should not be given those tables. The function returns
-- display names and roles, the notes the professional ticked "Visible to the
-- client" (NoteForm), and owner names for the client-visible tasks only.
--
-- DEPENDS ON: 001, 013, whitbyos/004 (workstreams.kind), whitbyos/007
-- (workplans.urgency, health; workstreams.blocked), whitbyos/012 (tasks.kind),
-- whitbyos/037 (tasks.completed_at), whitbyos/038 (archived_at, deleted_at).
--
-- The portal reads both functions defensively: until this file is applied it
-- draws 013's shape — the plan with its client-visible tasks and no owners —
-- and a Request with no people or notes listed.
--
-- Safe to re-run.
-- =====================================================================

begin;

-- 1 — the plan, in full ------------------------------------------------

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
    select t.id, t.workstream_id, t.title, t.status, t.kind, t.due_date,
           t.completed_at, t.created_at, t.owner_user_id,
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
                  -- Whitby's getWorkPlan orders a stream's tasks the same way.
                  order by tk.created_at
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


-- 2 — who is on the Request, and what was written for the client -------

create or replace function public.portal_request_detail(p_request_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with request as (
    select r.id, r.created_at, r.owner_user_id
    from public.whitbyos_requests r
    where r.id = p_request_id
      and public.portal_can_see_request(p_request_id)
  ),
  team as (
    select 0 as place,
           coalesce(nullif(btrim(u.preferred_name), ''), nullif(btrim(u.full_name), ''), 'Your team') as name,
           'Owner'::text as role
    from request rq
    join public.users u on u.id = rq.owner_user_id

    union all

    select 1,
           coalesce(nullif(btrim(u.preferred_name), ''), nullif(btrim(u.full_name), ''), 'Your team'),
           coalesce(nullif(btrim(pa.role), ''), 'Assisting')
    from request rq
    join public.whitbyos_request_participants pa
      on pa.request_id = rq.id and pa.participant_type = 'user'
    join public.users u on u.id = pa.participant_id
    where pa.participant_id is distinct from rq.owner_user_id

    union all

    select 2,
           coalesce(nullif(btrim(c.preferred_name), ''),
                    nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
                    'Member'),
           coalesce(nullif(btrim(pa.role), ''), 'Member')
    from request rq
    join public.whitbyos_request_participants pa
      on pa.request_id = rq.id and pa.participant_type = 'contact'
    join public.contacts c on c.id = pa.participant_id
  )
  select jsonb_build_object(
    'createdAt', rq.created_at,
    'ownerName', (select t.name from team t where t.place = 0 limit 1),
    'team', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'role', t.role) order by t.place, t.name)
      from team t
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'body', n.body,
          'createdAt', n.created_at,
          'authorName', coalesce(nullif(btrim(u.preferred_name), ''), nullif(btrim(u.full_name), ''))
        )
        order by n.created_at desc
      )
      from public.whitbyos_notes n
      left join public.users u on u.id = n.created_by_user_id
      where n.request_id = rq.id
        and n.visibility = 'client_visible'
    ), '[]'::jsonb),
    'taskOwners', coalesce((
      select jsonb_object_agg(
        t.id,
        coalesce(nullif(btrim(u.preferred_name), ''), nullif(btrim(u.full_name), ''), 'Your team')
      )
      from public.whitbyos_tasks t
      join public.users u on u.id = t.owner_user_id
      where t.request_id = rq.id
        and t.visibility = 'client_visible'
    ), '{}'::jsonb)
  )
  from request rq;
$$;

revoke all on function public.portal_request_detail(uuid) from public, anon;
grant execute on function public.portal_request_detail(uuid) to authenticated;

commit;


-- =====================================================================
-- VERIFY — signed in as a client, for a Request they can see:
-- =====================================================================
-- select public.portal_request_plans('<request id>');   -- '[]' until a plan is shared
-- select public.portal_request_detail('<request id>');  -- null for a Request they cannot see
