-- 070 — who on the team can see a Work Plan, and who can see one Work Stream.
--
-- WP.17v and WP.17u are both a list of the workspace's people with a checkbox
-- against each, and nothing in the schema could hold the answer: a plan knew
-- its owner and a stream knew its owner, and every other member of the
-- workspace saw both.
--
-- Two tables rather than one polymorphic one, because they are reached from
-- two different controls and deleted by two different cascades.
--
-- **An empty set means everyone.** A row is an allow-list entry, so if this
-- migration created no rows, every existing plan would have vanished from
-- every colleague's screen the moment it was applied. Absence therefore keeps
-- today's behaviour and only an explicit list narrows it — the same rule
-- `portal_can_see_billing()` uses for a membership with nothing decided (061).
-- The reader resolves it; the tables only record what was ticked.
--
-- Safe to re-run: every object is created if-not-exists and every policy is
-- dropped by name first.

create table if not exists public.whitbyos_workplan_viewers (
  workplan_id uuid not null references public.whitbyos_workplans(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workplan_id, user_id)
);

create table if not exists public.whitbyos_workstream_viewers (
  workstream_id uuid not null references public.whitbyos_workstreams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workstream_id, user_id)
);

-- Reading one person's plans means asking "which of these did they tick", so
-- the user is the lead column on both lookups.
create index if not exists whitbyos_workplan_viewers_user_idx
  on public.whitbyos_workplan_viewers (user_id);
create index if not exists whitbyos_workstream_viewers_user_idx
  on public.whitbyos_workstream_viewers (user_id);

alter table public.whitbyos_workplan_viewers enable row level security;
alter table public.whitbyos_workstream_viewers enable row level security;

-- Scoped exactly as the row they hang off: through the plan's request to the
-- workspace. Named _staff so the Client Portal can add its own _client policy
-- to the same table later without either side editing the other's.
drop policy if exists whitbyos_workplan_viewers_staff on public.whitbyos_workplan_viewers;
create policy whitbyos_workplan_viewers_staff
  on public.whitbyos_workplan_viewers
  for all
  using (
    exists (
      select 1
      from public.whitbyos_workplans wp
      join public.whitbyos_requests r on r.id = wp.request_id
      where wp.id = whitbyos_workplan_viewers.workplan_id
        and public.is_workspace_member(r.workspace_id)
    )
  );

drop policy if exists whitbyos_workstream_viewers_staff on public.whitbyos_workstream_viewers;
create policy whitbyos_workstream_viewers_staff
  on public.whitbyos_workstream_viewers
  for all
  using (
    exists (
      select 1
      from public.whitbyos_workstreams ws
      join public.whitbyos_workplans wp on wp.id = ws.workplan_id
      join public.whitbyos_requests r on r.id = wp.request_id
      where ws.id = whitbyos_workstream_viewers.workstream_id
        and public.is_workspace_member(r.workspace_id)
    )
  );
