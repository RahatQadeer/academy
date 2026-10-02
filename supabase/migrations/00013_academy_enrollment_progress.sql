-- Academy enrollment progress derivation (PA-ACA-010).
-- Academy-owned. Does not alter 00001–00012.
--
-- Learners still have no UPDATE on academy_enrollments (00011).
-- This function is the trusted path that derives:
--   progress_percent, status, completed_at
-- from academy_lesson_progress. It does not award credentials.

create or replace function public.academy_apply_enrollment_progress(
  p_enrollment_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_program_id uuid;
  v_total integer := 0;
  v_completed integer := 0;
  v_percent integer := 0;
  v_status public.academy_enrollment_status;
  v_completed_at timestamptz;
  v_existing_completed_at timestamptz;
begin
  if p_enrollment_id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  select e.user_id, e.program_id, e.completed_at
  into v_user_id, v_program_id, v_existing_completed_at
  from public.academy_enrollments e
  where e.id = p_enrollment_id
  for update;

  if v_user_id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  select count(*)::integer
  into v_total
  from public.academy_lessons l
  join public.academy_modules m on m.id = l.module_id
  where m.program_id = v_program_id;

  select count(*)::integer
  into v_completed
  from public.academy_lesson_progress p
  join public.academy_lessons l on l.id = p.lesson_id
  join public.academy_modules m on m.id = l.module_id
  where p.enrollment_id = p_enrollment_id
    and p.status = 'completed'
    and m.program_id = v_program_id;

  if v_total = 0 then
    v_percent := 0;
    v_status := 'enrolled';
    v_completed_at := null;
  else
    v_percent := least(100, greatest(0, round((v_completed::numeric * 100) / v_total::numeric)::integer));
    if v_completed = 0 then
      v_status := 'enrolled';
      v_completed_at := null;
    elsif v_completed >= v_total then
      v_status := 'completed';
      v_completed_at := coalesce(v_existing_completed_at, now());
    else
      v_status := 'in_progress';
      v_completed_at := null;
    end if;
  end if;

  update public.academy_enrollments
  set
    progress_percent = v_percent,
    status = v_status,
    completed_at = v_completed_at
  where id = p_enrollment_id;

  return jsonb_build_object(
    'status', 'ok',
    'progress_percent', v_percent,
    'enrollment_status', v_status,
    'completed_at', v_completed_at
  );
end;
$$;

create or replace function public.academy_recalculate_enrollment_progress(
  p_enrollment_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthenticated');
  end if;
  if not public.has_academy_entitlement() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'no_academy_access');
  end if;

  select e.user_id
  into v_owner
  from public.academy_enrollments e
  where e.id = p_enrollment_id;

  if v_owner is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  if v_owner is distinct from auth.uid()
    and not public.is_academy_admin()
  then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthorized');
  end if;

  if v_owner = auth.uid() and not public.has_academy_role('learner') and not public.is_academy_admin() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'no_learner_capability');
  end if;

  return public.academy_apply_enrollment_progress(p_enrollment_id);
end;
$$;

create or replace function public.academy_lesson_progress_sync_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' then
    perform public.academy_apply_enrollment_progress(new.enrollment_id);
  end if;
  return new;
end;
$$;

drop trigger if exists academy_lesson_progress_sync_enrollment on public.academy_lesson_progress;
create trigger academy_lesson_progress_sync_enrollment
  after insert or update of status on public.academy_lesson_progress
  for each row
  when (new.status = 'completed')
  execute function public.academy_lesson_progress_sync_enrollment();

revoke all on function public.academy_apply_enrollment_progress(uuid) from public, anon, authenticated;
revoke all on function public.academy_lesson_progress_sync_enrollment() from public, anon, authenticated;
revoke all on function public.academy_recalculate_enrollment_progress(uuid) from public, anon;

grant execute on function public.academy_recalculate_enrollment_progress(uuid) to authenticated, service_role;
