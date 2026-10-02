-- Queue completion credentials for admin review when a learner finishes a program.
-- Extends academy_apply_enrollment_progress (00013); does not alter prior migrations.

create or replace function public.academy_queue_completion_credential(
  p_user_id uuid,
  p_program_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_program_type public.academy_program_type;
  v_credential_type public.academy_credential_type;
begin
  if p_user_id is null or p_program_id is null then
    return;
  end if;

  if exists (
    select 1
    from public.academy_credentials c
    where c.user_id = p_user_id
      and c.program_id = p_program_id
  ) then
    return;
  end if;

  select p.type
  into v_program_type
  from public.academy_programs p
  where p.id = p_program_id;

  if v_program_type is null then
    return;
  end if;

  v_credential_type := case v_program_type
    when 'cpa' then 'cpa_credential'::public.academy_credential_type
    when 'specialty_endorsement' then 'specialty_endorsement'::public.academy_credential_type
    else 'certificate_of_completion'::public.academy_credential_type
  end;

  insert into public.academy_credentials (user_id, program_id, type, status)
  values (p_user_id, p_program_id, v_credential_type, 'credential_review');
end;
$$;

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

  if v_status = 'completed' then
    perform public.academy_queue_completion_credential(v_user_id, v_program_id);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'progress_percent', v_percent,
    'enrollment_status', v_status,
    'completed_at', v_completed_at
  );
end;
$$;

create or replace function public.academy_ensure_completion_credential(
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
  v_status public.academy_enrollment_status;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthenticated');
  end if;

  select e.user_id, e.program_id, e.status
  into v_user_id, v_program_id, v_status
  from public.academy_enrollments e
  where e.id = p_enrollment_id;

  if v_user_id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  if v_user_id is distinct from auth.uid() and not public.is_academy_admin() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthorized');
  end if;

  if v_status <> 'completed' then
    return jsonb_build_object('status', 'skipped', 'reason', 'not_completed');
  end if;

  perform public.academy_queue_completion_credential(v_user_id, v_program_id);
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.academy_queue_completion_credential(uuid, uuid) from public, anon, authenticated;
revoke all on function public.academy_ensure_completion_credential(uuid) from public, anon;

grant execute on function public.academy_ensure_completion_credential(uuid) to authenticated, service_role;
