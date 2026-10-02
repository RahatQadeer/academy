-- Hidden (unpublished) programs stay in the catalog tables so learner
-- certificates and enrollments are not deleted. Learners who already have
-- an enrollment or credential may still read the program row (name/status)
-- so Academy can show "this course is not available". Lesson content remains
-- gated by academy_can_read_program, which still requires published.

drop policy if exists academy_programs_select on public.academy_programs;
create policy academy_programs_select on public.academy_programs
  for select using (
    public.has_academy_entitlement()
    and (
      status = 'published'
      or public.is_academy_admin()
      or public.is_assigned_instructor(id)
      or (
        public.is_academy_instructor()
        and created_by_user_id = auth.uid()
      )
      or exists (
        select 1
        from public.academy_enrollments e
        where e.program_id = academy_programs.id
          and e.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.academy_credentials c
        where c.program_id = academy_programs.id
          and c.user_id = auth.uid()
      )
    )
  );
