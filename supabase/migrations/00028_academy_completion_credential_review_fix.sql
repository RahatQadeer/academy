-- Completion certificates should enter admin review when the learner finishes the
-- program. Applied-work stages apply to CPA credentials, not completion certs.

create or replace function public.academy_sync_credential_progress(
  p_credential_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.academy_credentials%rowtype;
  v_enrollment_id uuid;
  v_total_lessons integer := 0;
  v_completed_lessons integer := 0;
  v_total_assignments integer := 0;
  v_approved_submissions integer := 0;
  v_pending_submissions integer := 0;
  v_total_quizzes integer := 0;
  v_completed_quizzes integer := 0;
  v_learning_complete boolean := false;
  v_applied_complete boolean := false;
  v_assessment_complete boolean := false;
  v_next_status public.academy_credential_status;
begin
  select *
  into v_row
  from public.academy_credentials
  where id = p_credential_id
  for update;

  if v_row.id is null then
    return;
  end if;

  if auth.uid() is not null
     and v_row.user_id is distinct from auth.uid()
     and not public.is_academy_admin() then
    return;
  end if;

  if v_row.status in ('awarded') then
    return;
  end if;

  select e.id
  into v_enrollment_id
  from public.academy_enrollments e
  where e.user_id = v_row.user_id
    and e.program_id = v_row.program_id
    and e.status = 'completed'
  order by e.completed_at desc nulls last
  limit 1;

  if v_enrollment_id is null then
    return;
  end if;

  -- Certificates of completion: finished enrollment → admin review queue.
  if v_row.type = 'certificate_of_completion' then
    v_next_status := 'credential_review';
    if v_row.status is distinct from v_next_status then
      update public.academy_credentials
      set status = v_next_status
      where id = p_credential_id;
    end if;
    return;
  end if;

  select count(*)::integer,
         count(*) filter (
           where exists (
             select 1
             from public.academy_lesson_progress p
             where p.enrollment_id = v_enrollment_id
               and p.lesson_id = l.id
               and p.status = 'completed'
           )
         )::integer
  into v_total_lessons, v_completed_lessons
  from public.academy_lessons l
  join public.academy_modules m on m.id = l.module_id
  where m.program_id = v_row.program_id
    and l.type not in ('quiz', 'assignment');

  select count(*)::integer
  into v_total_assignments
  from public.academy_lessons l
  join public.academy_modules m on m.id = l.module_id
  where m.program_id = v_row.program_id
    and l.type = 'assignment';

  select count(*) filter (where s.status = 'approved')::integer,
         count(*) filter (where s.status in ('submitted', 'under_review'))::integer
  into v_approved_submissions, v_pending_submissions
  from public.academy_applied_work_submissions s
  where s.credential_id = p_credential_id;

  select count(*)::integer,
         count(*) filter (
           where exists (
             select 1
             from public.academy_lesson_progress p
             where p.enrollment_id = v_enrollment_id
               and p.lesson_id = l.id
               and p.status = 'completed'
           )
         )::integer
  into v_total_quizzes, v_completed_quizzes
  from public.academy_lessons l
  join public.academy_modules m on m.id = l.module_id
  where m.program_id = v_row.program_id
    and l.type = 'quiz';

  v_learning_complete := v_total_lessons > 0 and v_completed_lessons >= v_total_lessons;
  v_applied_complete := v_total_assignments = 0
    or v_approved_submissions >= v_total_assignments;
  v_assessment_complete := v_total_quizzes = 0 or v_completed_quizzes >= v_total_quizzes;

  v_next_status := case
    when not v_learning_complete then 'required_learning'::public.academy_credential_status
    when v_total_assignments > 0 and not v_applied_complete then 'applied_work'::public.academy_credential_status
    when v_total_quizzes > 0 and not v_assessment_complete then 'final_assessment'::public.academy_credential_status
    else 'credential_review'::public.academy_credential_status
  end;

  if v_row.status is distinct from v_next_status then
    update public.academy_credentials
    set status = v_next_status
    where id = p_credential_id;
  end if;
end;
$$;

-- Backfill completion certificates stuck in applied-work after course completion.
update public.academy_credentials c
set status = 'credential_review'
where c.type = 'certificate_of_completion'
  and c.status <> 'awarded'
  and c.status <> 'credential_review'
  and exists (
    select 1
    from public.academy_enrollments e
    where e.user_id = c.user_id
      and e.program_id = c.program_id
      and e.status = 'completed'
  );
