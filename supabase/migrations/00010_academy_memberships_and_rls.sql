-- Academy membership + authorization foundation (PA-ACA-003).
-- Academy-owned. Does not alter public.users or workspace_members.
--
-- First Academy Admin is an operational decision, not granted by this migration.
-- Do not map workspace owner/admin to Academy Admin.
-- Provision the first admin with the service role, for example:
--   insert into public.academy_memberships (user_id, role, status)
--   values ('<user-uuid>', 'admin', 'active');

do $$ begin
  create type public.academy_role as enum ('learner', 'instructor', 'admin');
exception when duplicate_object then null;
end $$;

alter type public.academy_role add value if not exists 'admin';

do $$ begin
  create type public.academy_membership_status as enum ('active', 'suspended');
exception when duplicate_object then null;
end $$;

create table if not exists public.academy_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role public.academy_role not null,
  status public.academy_membership_status not null default 'active',
  granted_by_user_id uuid references public.users (id),
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);

drop trigger if exists academy_memberships_set_updated_at on public.academy_memberships;
create trigger academy_memberships_set_updated_at
  before update on public.academy_memberships
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers (security definer, matching Base RLS style)
-- ---------------------------------------------------------------------------

create or replace function public.has_academy_entitlement()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_entitlement('academy');
$$;

create or replace function public.has_academy_role(p_role public.academy_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_memberships
    where user_id = auth.uid()
      and role = p_role
      and status = 'active'
  );
$$;

create or replace function public.is_academy_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_academy_role('admin');
$$;

create or replace function public.is_academy_instructor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_academy_role('instructor');
$$;

create or replace function public.is_assigned_instructor(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_instructor_assignments a
    join public.academy_memberships m
      on m.user_id = a.user_id
     and m.role = 'instructor'
     and m.status = 'active'
    where a.user_id = auth.uid()
      and a.program_id = p_program_id
  );
$$;

create or replace function public.academy_program_is_published(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_programs
    where id = p_program_id
      and status = 'published'
  );
$$;

create or replace function public.academy_can_read_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(p_program_id)
      or public.academy_program_is_published(p_program_id)
    );
$$;

create or replace function public.academy_program_id_from_lesson(p_lesson_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.program_id
  from public.academy_lessons l
  join public.academy_modules m on m.id = l.module_id
  where l.id = p_lesson_id
$$;

create or replace function public.academy_program_id_from_quiz(p_quiz_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.academy_program_id_from_lesson(lesson_id)
  from public.academy_quizzes
  where id = p_quiz_id
$$;

create or replace function public.academy_program_id_from_module(p_module_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select program_id
  from public.academy_modules
  where id = p_module_id
$$;

create or replace function public.academy_program_has_approved_publish(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_publish_requests
    where program_id = p_program_id
      and status = 'approved'
  );
$$;

create or replace function public.academy_assignment_requires_instructor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.academy_memberships
    where user_id = new.user_id
      and role = 'instructor'
      and status = 'active'
  ) then
    raise exception 'academy_instructor_assignments requires an active instructor membership';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_instructor_assignments_require_role on public.academy_instructor_assignments;
create trigger academy_instructor_assignments_require_role
  before insert or update of user_id on public.academy_instructor_assignments
  for each row execute function public.academy_assignment_requires_instructor();

-- ---------------------------------------------------------------------------
-- Memberships RLS
-- ---------------------------------------------------------------------------

alter table public.academy_memberships enable row level security;

drop policy if exists academy_memberships_select on public.academy_memberships;
drop policy if exists academy_memberships_insert on public.academy_memberships;
drop policy if exists academy_memberships_update on public.academy_memberships;
drop policy if exists academy_memberships_delete on public.academy_memberships;

create policy academy_memberships_select on public.academy_memberships
  for select using (
    user_id = auth.uid() or public.is_academy_admin()
  );

create policy academy_memberships_insert on public.academy_memberships
  for insert with check (
    (
      user_id = auth.uid()
      and role = 'learner'
      and status = 'active'
      and public.has_academy_entitlement()
    )
    or public.is_academy_admin()
  );

create policy academy_memberships_update on public.academy_memberships
  for update using (public.is_academy_admin())
  with check (public.is_academy_admin());

create policy academy_memberships_delete on public.academy_memberships
  for delete using (public.is_academy_admin());

-- ---------------------------------------------------------------------------
-- Replace conflicting Academy policies from 00006
-- ---------------------------------------------------------------------------

drop policy if exists academy_programs_select on public.academy_programs;
drop policy if exists academy_programs_write on public.academy_programs;
drop policy if exists academy_programs_insert on public.academy_programs;
drop policy if exists academy_programs_update on public.academy_programs;
drop policy if exists academy_programs_delete on public.academy_programs;
drop policy if exists academy_catalog_read on public.academy_modules;
drop policy if exists academy_modules_select on public.academy_modules;
drop policy if exists academy_modules_write on public.academy_modules;
drop policy if exists academy_lessons_read on public.academy_lessons;
drop policy if exists academy_lessons_select on public.academy_lessons;
drop policy if exists academy_lessons_write on public.academy_lessons;
drop policy if exists academy_quizzes_select on public.academy_quizzes;
drop policy if exists academy_quizzes_write on public.academy_quizzes;
drop policy if exists academy_questions_select on public.academy_questions;
drop policy if exists academy_questions_write on public.academy_questions;
drop policy if exists academy_assignments_select on public.academy_instructor_assignments;
drop policy if exists academy_assignments_write on public.academy_instructor_assignments;
drop policy if exists academy_publish_select on public.academy_publish_requests;
drop policy if exists academy_publish_insert on public.academy_publish_requests;
drop policy if exists academy_publish_update on public.academy_publish_requests;
drop policy if exists academy_enrollments_own on public.academy_enrollments;
drop policy if exists academy_enrollments_select on public.academy_enrollments;
drop policy if exists academy_enrollments_insert on public.academy_enrollments;
drop policy if exists academy_enrollments_update on public.academy_enrollments;
drop policy if exists academy_enrollments_delete on public.academy_enrollments;
drop policy if exists academy_progress_own on public.academy_lesson_progress;
drop policy if exists academy_progress_select on public.academy_lesson_progress;
drop policy if exists academy_progress_write on public.academy_lesson_progress;
drop policy if exists academy_credentials_own on public.academy_credentials;
drop policy if exists academy_credentials_select on public.academy_credentials;
drop policy if exists academy_credentials_write on public.academy_credentials;
drop policy if exists academy_training_own on public.academy_training_workspaces;
drop policy if exists academy_training_select on public.academy_training_workspaces;

-- Programs

create policy academy_programs_select on public.academy_programs
  for select using (
    public.has_academy_entitlement()
    and (
      status = 'published'
      or public.is_academy_admin()
      or public.is_assigned_instructor(id)
    )
  );

create policy academy_programs_insert on public.academy_programs
  for insert with check (
    public.has_academy_entitlement()
    and public.is_academy_admin()
    and created_by_user_id = auth.uid()
  );

create policy academy_programs_update on public.academy_programs
  for update using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(id)
    )
  )
  with check (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or (
        public.is_assigned_instructor(id)
        and (
          status is distinct from 'published'
          or public.academy_program_has_approved_publish(id)
        )
      )
    )
  );

create policy academy_programs_delete on public.academy_programs
  for delete using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

-- Modules

create policy academy_modules_select on public.academy_modules
  for select using (public.academy_can_read_program(program_id));

create policy academy_modules_write on public.academy_modules
  for all using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(program_id)
    )
  )
  with check (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(program_id)
    )
  );

-- Lessons

create policy academy_lessons_select on public.academy_lessons
  for select using (
    public.academy_can_read_program(public.academy_program_id_from_module(module_id))
  );

create policy academy_lessons_write on public.academy_lessons
  for all using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(public.academy_program_id_from_module(module_id))
    )
  )
  with check (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(public.academy_program_id_from_module(module_id))
    )
  );

-- Quizzes (no answer key on this table)

create policy academy_quizzes_select on public.academy_quizzes
  for select using (
    public.academy_can_read_program(public.academy_program_id_from_lesson(lesson_id))
  );

create policy academy_quizzes_write on public.academy_quizzes
  for all using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(public.academy_program_id_from_lesson(lesson_id))
    )
  )
  with check (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(public.academy_program_id_from_lesson(lesson_id))
    )
  );

-- Questions contain correct_answer. Learners get no SELECT.
-- Learner quiz-taking will need a safe view/RPC in a later ticket.

create policy academy_questions_select on public.academy_questions
  for select using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(public.academy_program_id_from_quiz(quiz_id))
    )
  );

create policy academy_questions_write on public.academy_questions
  for all using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(public.academy_program_id_from_quiz(quiz_id))
    )
  )
  with check (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(public.academy_program_id_from_quiz(quiz_id))
    )
  );

-- Instructor assignments

create policy academy_assignments_select on public.academy_instructor_assignments
  for select using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or (user_id = auth.uid() and public.is_academy_instructor())
    )
  );

create policy academy_assignments_write on public.academy_instructor_assignments
  for all using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  )
  with check (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

-- Publish requests

create policy academy_publish_select on public.academy_publish_requests
  for select using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.is_assigned_instructor(program_id)
      or submitted_by_user_id = auth.uid()
    )
  );

create policy academy_publish_insert on public.academy_publish_requests
  for insert with check (
    public.has_academy_entitlement()
    and submitted_by_user_id = auth.uid()
    and public.is_assigned_instructor(program_id)
    and status = 'pending'
  );

create policy academy_publish_update on public.academy_publish_requests
  for update using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  )
  with check (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

-- Enrollments: learner own; admin manage; instructor no extra access

create policy academy_enrollments_select on public.academy_enrollments
  for select using (
    public.has_academy_entitlement()
    and (user_id = auth.uid() or public.is_academy_admin())
  );

create policy academy_enrollments_insert on public.academy_enrollments
  for insert with check (
    public.has_academy_entitlement()
    and (user_id = auth.uid() or public.is_academy_admin())
  );

create policy academy_enrollments_update on public.academy_enrollments
  for update using (
    public.has_academy_entitlement()
    and (user_id = auth.uid() or public.is_academy_admin())
  )
  with check (
    public.has_academy_entitlement()
    and (user_id = auth.uid() or public.is_academy_admin())
  );

create policy academy_enrollments_delete on public.academy_enrollments
  for delete using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

-- Progress

create policy academy_progress_select on public.academy_lesson_progress
  for select using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or exists (
        select 1 from public.academy_enrollments e
        where e.id = enrollment_id and e.user_id = auth.uid()
      )
    )
  );

create policy academy_progress_write on public.academy_lesson_progress
  for all using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or exists (
        select 1 from public.academy_enrollments e
        where e.id = enrollment_id and e.user_id = auth.uid()
      )
    )
  )
  with check (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or exists (
        select 1 from public.academy_enrollments e
        where e.id = enrollment_id and e.user_id = auth.uid()
      )
    )
  );

-- Credentials: learner own read; admin manage

create policy academy_credentials_select on public.academy_credentials
  for select using (
    public.has_academy_entitlement()
    and (user_id = auth.uid() or public.is_academy_admin())
  );

create policy academy_credentials_write on public.academy_credentials
  for all using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  )
  with check (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

-- Training workspaces: keep owner read; add admin read. No Whitby handoff here.

create policy academy_training_select on public.academy_training_workspaces
  for select using (
    public.has_academy_entitlement()
    and (user_id = auth.uid() or public.is_academy_admin())
  );

grant execute on function public.has_academy_entitlement() to anon, authenticated, service_role;
grant execute on function public.has_academy_role(public.academy_role) to anon, authenticated, service_role;
grant execute on function public.is_academy_admin() to anon, authenticated, service_role;
grant execute on function public.is_academy_instructor() to anon, authenticated, service_role;
grant execute on function public.is_assigned_instructor(uuid) to anon, authenticated, service_role;
grant execute on function public.academy_program_is_published(uuid) to anon, authenticated, service_role;
grant execute on function public.academy_can_read_program(uuid) to anon, authenticated, service_role;
grant execute on function public.academy_program_id_from_lesson(uuid) to anon, authenticated, service_role;
grant execute on function public.academy_program_id_from_quiz(uuid) to anon, authenticated, service_role;
grant execute on function public.academy_program_id_from_module(uuid) to anon, authenticated, service_role;
grant execute on function public.academy_program_has_approved_publish(uuid) to anon, authenticated, service_role;
