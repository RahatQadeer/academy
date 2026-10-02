-- Academy free self-enrollment integrity (PA-ACA-006).
-- Academy-owned. Does not alter Base identity tables or old Academy migrations.
--
-- unique(user_id, program_id) already exists on academy_enrollments (00006).
-- This migration does not add or drop that constraint.

create or replace function public.academy_program_is_free_published(p_program_id uuid)
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
      and price is null
  );
$$;

-- Uses prerequisite_program_id only. Specialty-without-FK is enforced in the
-- application enrollment service, matching Explore display rules.
create or replace function public.academy_self_prerequisite_satisfied(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        p.prerequisite_program_id is null
        or exists (
          select 1
          from public.academy_enrollments e
          where e.user_id = auth.uid()
            and e.program_id = p.prerequisite_program_id
            and e.status = 'completed'
        )
        or exists (
          select 1
          from public.academy_credentials c
          where c.user_id = auth.uid()
            and c.program_id = p.prerequisite_program_id
            and c.status = 'awarded'
        )
      from public.academy_programs p
      where p.id = p_program_id
    ),
    false
  );
$$;

drop policy if exists academy_enrollments_insert on public.academy_enrollments;
drop policy if exists academy_enrollments_insert_learner on public.academy_enrollments;
drop policy if exists academy_enrollments_insert_admin on public.academy_enrollments;
drop policy if exists academy_enrollments_update on public.academy_enrollments;
drop policy if exists academy_enrollments_update_admin on public.academy_enrollments;
drop policy if exists academy_enrollments_update_learner on public.academy_enrollments;

create policy academy_enrollments_insert_learner on public.academy_enrollments
  for insert with check (
    public.has_academy_entitlement()
    and public.has_academy_role('learner')
    and user_id = auth.uid()
    and status = 'enrolled'
    and progress_percent = 0
    and entitlement_source = 'free'
    and completed_at is null
    and public.academy_program_is_free_published(program_id)
    and public.academy_self_prerequisite_satisfied(program_id)
  );

create policy academy_enrollments_insert_admin on public.academy_enrollments
  for insert with check (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

-- Learners cannot update enrollment rows. Progress/status changes go through
-- a later server-authorized path, not a direct client write.
create policy academy_enrollments_update_admin on public.academy_enrollments
  for update using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  )
  with check (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

grant execute on function public.academy_program_is_free_published(uuid) to anon, authenticated, service_role;
grant execute on function public.academy_self_prerequisite_satisfied(uuid) to anon, authenticated, service_role;
