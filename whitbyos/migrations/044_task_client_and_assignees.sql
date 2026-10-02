-- 16z — the two things the New Task modal asks for that we could not hold.
--
-- 1. "Client / Workspace", whose first option is "None (unassigned to a
--    client)". A task's client came only through its Request, so a task with
--    no Request belonged to nobody — and the reference's own list has a
--    "General" view for exactly those. The column is nullable because the
--    modal's first option says it may be.
--
-- 2. Assignees, plural. The reference draws two avatars on one row and says
--    "Assign to any mix of internal team members and client contacts";
--    whitbyos_tasks holds one owner_user_id.
--
-- On the second: this table is the record, and owner_user_id becomes the first
-- assignee written from it. Two columns holding one fact is how counts and
-- lists start disagreeing, so there is exactly one code path that writes both
-- — `setTaskAssignees`. Everything that already reads owner_user_id (the Work
-- Plan views, the Kanban, the exported document) keeps working and keeps
-- being right.
--
-- Client contacts as assignees are deliberately not built. A contact is not an
-- auth user, so assigning one raises questions the SRS does not answer — what
-- they are notified by, what they can see when they follow it, whether it
-- appears in their portal. Left to ask rather than invented.

alter table public.whitbyos_tasks
  add column if not exists client_id uuid references public.whitbyos_clients(id) on delete set null;

create index if not exists whitbyos_tasks_client_idx
  on public.whitbyos_tasks (client_id)
  where client_id is not null;

create table if not exists public.whitbyos_task_assignees (
  task_id uuid not null references public.whitbyos_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Which one owner_user_id mirrors, and the order the avatars stack in.
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists whitbyos_task_assignees_user_idx
  on public.whitbyos_task_assignees (user_id);

alter table public.whitbyos_task_assignees enable row level security;

drop policy if exists whitbyos_task_assignees_staff on public.whitbyos_task_assignees;
create policy whitbyos_task_assignees_staff
  on public.whitbyos_task_assignees
  for all
  using (
    exists (
      select 1 from public.whitbyos_tasks t
      where t.id = whitbyos_task_assignees.task_id
        and is_workspace_member(t.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.whitbyos_tasks t
      where t.id = whitbyos_task_assignees.task_id
        and is_workspace_member(t.workspace_id)
    )
  );
