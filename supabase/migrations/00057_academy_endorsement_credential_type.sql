-- Fix endorsement programs issuing completion certificates.
-- 1) Resolve credential type from recognition OR program type.
-- 2) Sync existing / in-flight credentials when recognition changes.
-- 3) Queue path updates wrong types instead of leaving them stuck.

create or replace function public.academy_credential_type_for_program(
  p_recognition public.academy_course_recognition,
  p_type public.academy_program_type
)
returns public.academy_credential_type
language sql
immutable
as $$
  select case
    when p_recognition = 'professional_certification'::public.academy_course_recognition
      or p_type = 'certification_program'::public.academy_program_type
      then 'cpa_credential'::public.academy_credential_type
    when p_recognition = 'specialty_endorsement'::public.academy_course_recognition
      or p_type = 'endorsement_program'::public.academy_program_type
      then 'specialty_endorsement'::public.academy_credential_type
    when p_recognition = 'none'::public.academy_course_recognition
      then 'certificate_of_completion'::public.academy_credential_type
    else 'certificate_of_completion'::public.academy_credential_type
  end;
$$;

create or replace function public.academy_sync_program_credential_types(
  p_program_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_recognition public.academy_course_recognition;
  v_type public.academy_program_type;
  v_credential_type public.academy_credential_type;
  v_updated integer := 0;
begin
  if p_program_id is null then
    return 0;
  end if;

  select p.recognition, p.type
  into v_recognition, v_type
  from public.academy_programs p
  where p.id = p_program_id;

  if v_type is null then
    return 0;
  end if;

  if v_recognition is null or v_recognition = 'none'::public.academy_course_recognition then
    return 0;
  end if;

  v_credential_type := public.academy_credential_type_for_program(v_recognition, v_type);

  update public.academy_credentials c
  set type = v_credential_type
  where c.program_id = p_program_id
    and c.type is distinct from v_credential_type
    and c.status is distinct from 'awarded'::public.academy_credential_status;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

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
  v_recognition public.academy_course_recognition;
  v_program_type public.academy_program_type;
  v_credential_type public.academy_credential_type;
  v_initial_status public.academy_credential_status;
  v_has_assignments boolean := false;
  v_existing_id uuid;
begin
  if p_user_id is null or p_program_id is null then
    return;
  end if;

  select p.recognition, p.type
  into v_recognition, v_program_type
  from public.academy_programs p
  where p.id = p_program_id;

  if v_recognition is null or v_recognition = 'none'::public.academy_course_recognition then
    return;
  end if;

  v_credential_type := public.academy_credential_type_for_program(v_recognition, v_program_type);

  select c.id
  into v_existing_id
  from public.academy_credentials c
  where c.user_id = p_user_id
    and c.program_id = p_program_id
  limit 1;

  if v_existing_id is not null then
    update public.academy_credentials
    set type = v_credential_type
    where id = v_existing_id
      and status is distinct from 'awarded'::public.academy_credential_status
      and type is distinct from v_credential_type;
    return;
  end if;

  select exists (
    select 1
    from public.academy_program_required_assignment_ids(p_program_id)
  )
  into v_has_assignments;

  v_initial_status := case
    when v_has_assignments then 'applied_work'::public.academy_credential_status
    else 'credential_review'::public.academy_credential_status
  end;

  insert into public.academy_credentials (user_id, program_id, type, status)
  values (p_user_id, p_program_id, v_credential_type, v_initial_status);
end;
$$;

create or replace function public.academy_queue_completion_certificate(
  p_user_id uuid,
  p_program_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.academy_queue_completion_credential(p_user_id, p_program_id);
end;
$$;

-- Backfill: endorsement / certification programs + recognition mismatches
update public.academy_credentials c
set type = public.academy_credential_type_for_program(p.recognition, p.type)
from public.academy_programs p
where p.id = c.program_id
  and p.recognition is distinct from 'none'::public.academy_course_recognition
  and c.type is distinct from public.academy_credential_type_for_program(p.recognition, p.type);

-- Also flip live program recognition when type is endorsement but recognition lagged
update public.academy_programs
set recognition = 'specialty_endorsement'::public.academy_course_recognition
where type = 'endorsement_program'::public.academy_program_type
  and recognition is distinct from 'specialty_endorsement'::public.academy_course_recognition;

update public.academy_programs
set recognition = 'professional_certification'::public.academy_course_recognition
where type = 'certification_program'::public.academy_program_type
  and recognition is distinct from 'professional_certification'::public.academy_course_recognition
  and recognition is distinct from 'none'::public.academy_course_recognition;

-- Re-sync credentials after program recognition repair
update public.academy_credentials c
set type = public.academy_credential_type_for_program(p.recognition, p.type)
from public.academy_programs p
where p.id = c.program_id
  and p.recognition is distinct from 'none'::public.academy_course_recognition
  and c.type is distinct from public.academy_credential_type_for_program(p.recognition, p.type);

grant execute on function public.academy_credential_type_for_program(
  public.academy_course_recognition,
  public.academy_program_type
) to authenticated, service_role;

grant execute on function public.academy_sync_program_credential_types(uuid)
  to authenticated, service_role;
