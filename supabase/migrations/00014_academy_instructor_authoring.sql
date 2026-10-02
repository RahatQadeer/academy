-- Instructor course authoring (PA-ACA-014).
-- Academy-owned. Instructors may create draft programs and edit programs they
-- created or are assigned to. They still cannot publish without an approved
-- academy_publish_requests row (or Academy Admin).

create or replace function public.academy_can_author_program(p_program_id uuid)
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
      or (
        public.is_academy_instructor()
        and exists (
          select 1
          from public.academy_programs p
          where p.id = p_program_id
            and p.created_by_user_id = auth.uid()
        )
      )
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
      or (
        public.is_academy_instructor()
        and exists (
          select 1
          from public.academy_programs p
          where p.id = p_program_id
            and p.created_by_user_id = auth.uid()
        )
      )
    );
$$;

create or replace function public.academy_programs_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by_user_id is distinct from auth.uid()
       and not public.is_academy_admin() then
      raise exception 'academy_programs created_by_user_id must be the session user';
    end if;
    if new.status = 'published' and not public.is_academy_admin() then
      raise exception 'academy_programs insert cannot be published';
    end if;
    return new;
  end if;

  if new.created_by_user_id is distinct from old.created_by_user_id then
    raise exception 'academy_programs created_by_user_id cannot change';
  end if;

  if new.status = 'published' and old.status is distinct from 'published' then
    if public.is_academy_admin() then
      return new;
    end if;
    if public.academy_can_author_program(new.id)
       and public.academy_program_has_approved_publish(new.id) then
      return new;
    end if;
    raise exception 'academy_programs publish requires admin approval';
  end if;

  return new;
end;
$$;

drop trigger if exists academy_programs_guard_status on public.academy_programs;
create trigger academy_programs_guard_status
  before insert or update on public.academy_programs
  for each row execute function public.academy_programs_guard_status();

create or replace function public.academy_instructor_create_program(
  p_name text,
  p_type public.academy_program_type,
  p_category text default null,
  p_description text default null,
  p_prerequisite_program_id uuid default null,
  p_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.has_academy_entitlement() or not public.is_academy_instructor() then
    raise exception 'instructor access required';
  end if;

  v_name := trim(both from coalesce(p_name, ''));
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'invalid program name';
  end if;
  if p_price is not null and p_price < 0 then
    raise exception 'invalid program price';
  end if;
  if p_prerequisite_program_id is not null
     and not exists (
       select 1 from public.academy_programs where id = p_prerequisite_program_id
     ) then
    raise exception 'invalid prerequisite';
  end if;

  insert into public.academy_programs (
    name,
    type,
    category,
    description,
    prerequisite_program_id,
    price,
    status,
    created_by_user_id
  )
  values (
    v_name,
    p_type,
    nullif(trim(both from coalesce(p_category, '')), ''),
    nullif(trim(both from coalesce(p_description, '')), ''),
    p_prerequisite_program_id,
    p_price,
    'draft',
    auth.uid()
  )
  returning id into v_id;

  if not exists (
    select 1
    from public.academy_instructor_assignments
    where user_id = auth.uid()
      and program_id = v_id
  ) then
    insert into public.academy_instructor_assignments (
      user_id,
      program_id,
      permission_level,
      assigned_by_admin_user_id
    )
    values (auth.uid(), v_id, 'create', null);
  end if;

  return v_id;
end;
$$;

revoke all on function public.academy_instructor_create_program(
  text, public.academy_program_type, text, text, uuid, numeric
) from public;
grant execute on function public.academy_can_author_program(uuid) to authenticated, service_role;
grant execute on function public.academy_instructor_create_program(
  text, public.academy_program_type, text, text, uuid, numeric
) to authenticated, service_role;

drop policy if exists academy_programs_select on public.academy_programs;
create policy academy_programs_select on public.academy_programs
  for select using (
    public.has_academy_entitlement()
    and (
      status = 'published'
      or public.is_academy_admin()
      or public.is_assigned_instructor(id)
      or (public.is_academy_instructor() and created_by_user_id = auth.uid())
    )
  );

drop policy if exists academy_programs_insert on public.academy_programs;
create policy academy_programs_insert on public.academy_programs
  for insert with check (
    public.has_academy_entitlement()
    and created_by_user_id = auth.uid()
    and (
      public.is_academy_admin()
      or (public.is_academy_instructor() and status = 'draft')
    )
  );

drop policy if exists academy_programs_update on public.academy_programs;
create policy academy_programs_update on public.academy_programs
  for update using (
    public.academy_can_author_program(id)
  )
  with check (
    public.academy_can_author_program(id)
    and (
      public.is_academy_admin()
      or (
        status is distinct from 'published'
        or public.academy_program_has_approved_publish(id)
      )
    )
  );

drop policy if exists academy_modules_write on public.academy_modules;
create policy academy_modules_write on public.academy_modules
  for all using (public.academy_can_author_program(program_id))
  with check (public.academy_can_author_program(program_id));

drop policy if exists academy_lessons_write on public.academy_lessons;
create policy academy_lessons_write on public.academy_lessons
  for all using (
    public.academy_can_author_program(public.academy_program_id_from_module(module_id))
  )
  with check (
    public.academy_can_author_program(public.academy_program_id_from_module(module_id))
  );

drop policy if exists academy_quizzes_write on public.academy_quizzes;
create policy academy_quizzes_write on public.academy_quizzes
  for all using (
    public.academy_can_author_program(public.academy_program_id_from_lesson(lesson_id))
  )
  with check (
    public.academy_can_author_program(public.academy_program_id_from_lesson(lesson_id))
  );

drop policy if exists academy_questions_write on public.academy_questions;
create policy academy_questions_write on public.academy_questions
  for all using (
    public.academy_can_author_program(public.academy_program_id_from_quiz(quiz_id))
  )
  with check (
    public.academy_can_author_program(public.academy_program_id_from_quiz(quiz_id))
  );

drop policy if exists academy_questions_select on public.academy_questions;
create policy academy_questions_select on public.academy_questions
  for select using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.academy_can_author_program(public.academy_program_id_from_quiz(quiz_id))
    )
  );

drop policy if exists academy_publish_select on public.academy_publish_requests;
create policy academy_publish_select on public.academy_publish_requests
  for select using (
    public.has_academy_entitlement()
    and (
      public.is_academy_admin()
      or public.academy_can_author_program(program_id)
      or submitted_by_user_id = auth.uid()
    )
  );

drop policy if exists academy_publish_insert on public.academy_publish_requests;
create policy academy_publish_insert on public.academy_publish_requests
  for insert with check (
    public.has_academy_entitlement()
    and submitted_by_user_id = auth.uid()
    and public.academy_can_author_program(program_id)
    and status = 'pending'
  );
