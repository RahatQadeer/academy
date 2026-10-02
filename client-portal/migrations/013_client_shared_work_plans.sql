-- =====================================================================
-- Work Plans the professional has chosen to share with the client.
-- Proposed by: Rohail (client-portal). Owner / sign-off: Sabahat (whitbyos_*).
--
-- SRS 13.11.2 keeps the *internal* Professional Workplan and its Workstreams
-- off the client's Request view. This file does not relax that for any plan
-- nobody chose to share: every plan stays exactly as internal as it is today
-- until a professional ticks "Share with the client" on WP.17v. Record the
-- decision against 13.11.2 before applying — it is a product change, not only
-- a schema one.
--
-- WHAT A SHARED PLAN SHOWS, AND WHAT IT NEVER DOES
--
-- A plan is reached only through one definer function, never through a select
-- policy. A policy would grant the whole row — `definition_of_done`, `owner`,
-- `current_next_action`, `version`, the viewer allow-lists — and every
-- Workstream column with it. The function hands out a fixed set of fields:
--
--   plan     name, desired outcome, status, start and target dates, progress
--   stream   name, purpose, status (blocked folded in), target date, progress
--   task     title, status, due and completed dates — client_visible ones only
--
-- Considerations, dependencies, providers, worksheets, risks, owners, charts,
-- versions and the source Playbook are not in the function and so cannot reach
-- the portal by any route.
--
-- Progress is returned as a percentage and never as counts. A stream with
-- three listed tasks and "40%" says the work is further along than the list;
-- "3 of 11" would say how much internal work there is, which is the part the
-- professional did not share. A stream with no tasks at all returns null, not
-- 0 — zero of zero is nothing to report, not "no progress".
--
-- A plan's percentage is counted over the streams the client can see, so a
-- stream the professional hid does not leak its size through the total.
--
-- WHAT IS NEVER RETURNED, WHATEVER IS TICKED
--
--   * a plan on a Request the reader cannot see (portal_can_see_request, 001)
--   * a draft — sharing one is allowed, and it appears once it is adopted
--   * an archived or deleted plan (whitbyos/038)
--   * a stream marked client_hidden
--
-- DEPENDS ON: 001 (portal_can_see_request), whitbyos/007 (workstreams.blocked),
-- whitbyos/037 (tasks.completed_at), whitbyos/038 (archived_at, deleted_at).
--
-- The portal degrades to today's behaviour without this file: its reader
-- treats a missing function as "nothing shared" and the Request screen draws
-- no Plan tab.
--
-- Safe to re-run.
-- =====================================================================

begin;

-- 1 — the professional's two switches ----------------------------------

alter table public.whitbyos_workplans
  add column if not exists client_shared_at timestamptz,
  add column if not exists client_shared_by_user_id uuid references public.users (id);

-- Hidden rather than shown: a default of false keeps every stream of a plan
-- visible the moment the plan is shared, which is what sharing a plan means.
-- The per-stream switch is for taking one out, not for putting each one in.
alter table public.whitbyos_workstreams
  add column if not exists client_hidden boolean not null default false;


-- 2 — the one read path ------------------------------------------------

create or replace function public.portal_request_plans(p_request_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with shared as (
    select wp.*
    from public.whitbyos_workplans wp
    where wp.request_id = p_request_id
      and public.portal_can_see_request(p_request_id)
      and wp.client_shared_at is not null
      and wp.archived_at is null
      and wp.deleted_at is null
      and wp.status <> 'draft'
  ),
  streams as (
    select ws.*,
      (select count(*) from public.whitbyos_tasks t where t.workstream_id = ws.id) as task_total,
      (select count(*) from public.whitbyos_tasks t
        where t.workstream_id = ws.id
          and lower(t.status) in ('complete', 'completed', 'done')) as task_done
    from public.whitbyos_workstreams ws
    where ws.workplan_id in (select id from shared)
      and ws.client_hidden = false
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'desiredOutcome', p.desired_outcome,
        'status', p.status,
        'startDate', p.start_date,
        'targetDate', p.target_date,
        'sharedAt', p.client_shared_at,
        'updatedAt', p.updated_at,
        'progress', (
          select case when sum(s.task_total) = 0 or sum(s.task_total) is null then null
                      else round(100.0 * sum(s.task_done) / sum(s.task_total)) end
          from streams s where s.workplan_id = p.id
        ),
        'streams', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'name', s.name,
              'purpose', s.purpose,
              'status', s.status,
              'blocked', s.blocked,
              'targetDate', s.target_date,
              'progress', case when s.task_total = 0 then null
                               else round(100.0 * s.task_done / s.task_total) end,
              'tasks', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', t.id,
                    'title', t.title,
                    'status', t.status,
                    'dueAt', t.due_date,
                    'completedAt', t.completed_at
                  )
                  order by t.due_date nulls last, t.created_at
                )
                from public.whitbyos_tasks t
                where t.workstream_id = s.id
                  and t.visibility = 'client_visible'
              ), '[]'::jsonb)
            )
            order by s.sort_order, s.created_at
          )
          from streams s where s.workplan_id = p.id
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
-- VERIFY
-- =====================================================================
-- -- three columns:
-- select table_name, column_name from information_schema.columns
-- where table_schema = 'public'
--   and ((table_name = 'whitbyos_workplans'
--          and column_name in ('client_shared_at', 'client_shared_by_user_id'))
--     or (table_name = 'whitbyos_workstreams' and column_name = 'client_hidden'));
--
-- -- signed in as a client, for a Request they can see: '[]' until a plan on it
-- -- is shared and active; signed in as anyone without sight of it, '[]'.
-- select public.portal_request_plans('<request id>');
