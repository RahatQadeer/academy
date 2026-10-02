-- Academy course type / access / recognition model (Rahat).
-- Separates Course Type from Access, Recognition, and Learning Path.
-- Maps legacy program types without deleting rows.
-- Safe to re-run after a partial failure on DROP TYPE.

-- 1) New enums -----------------------------------------------------------------
do $$ begin
  create type public.academy_course_access as enum (
    'free',
    'standard_plus',
    'professional_plus',
    'teams_plus',
    'purchased',
    'organization_assigned'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.academy_course_recognition as enum (
    'none',
    'certificate_of_completion',
    'professional_certification',
    'specialty_endorsement'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.academy_learning_path as enum (
    'whitby',
    'business_and_practice',
    'specialty',
    'certification',
    'organization_training'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.academy_program_type_v2 as enum (
    'short_course',
    'course',
    'certification_program',
    'endorsement_program'
  );
exception when duplicate_object then null;
end $$;

-- 2) Add metadata columns (nullable during backfill) ---------------------------
alter table public.academy_programs
  add column if not exists access public.academy_course_access,
  add column if not exists recognition public.academy_course_recognition,
  add column if not exists learning_path public.academy_learning_path;

-- 3) Backfill access / recognition / learning_path from legacy type ------------
update public.academy_programs
set
  access = case type::text
    when 'cpa' then 'purchased'::public.academy_course_access
    when 'specialty_endorsement' then 'purchased'::public.academy_course_access
    when 'paid_course' then 'purchased'::public.academy_course_access
    when 'professional_practice_accelerator' then 'professional_plus'::public.academy_course_access
    when 'intelligent_coordination' then 'free'::public.academy_course_access
    when 'free_course' then 'free'::public.academy_course_access
    else 'free'::public.academy_course_access
  end,
  recognition = case type::text
    when 'cpa' then 'professional_certification'::public.academy_course_recognition
    when 'specialty_endorsement' then 'specialty_endorsement'::public.academy_course_recognition
    else 'certificate_of_completion'::public.academy_course_recognition
  end,
  learning_path = case type::text
    when 'cpa' then 'certification'::public.academy_learning_path
    when 'specialty_endorsement' then 'specialty'::public.academy_learning_path
    when 'intelligent_coordination' then 'whitby'::public.academy_learning_path
    when 'professional_practice_accelerator' then 'business_and_practice'::public.academy_learning_path
    else 'business_and_practice'::public.academy_learning_path
  end
where access is null or recognition is null or learning_path is null;

-- Clear CPA-as-default prerequisite on endorsements (endorsements are independent).
update public.academy_programs p
set prerequisite_program_id = null
where p.type::text = 'specialty_endorsement'
  and p.prerequisite_program_id is not null
  and exists (
    select 1
    from public.academy_programs prereq
    where prereq.id = p.prerequisite_program_id
      and prereq.type::text = 'cpa'
  );

-- 4) Remap type column to the four official course types -----------------------
-- Functions that take/return the old enum must be dropped before DROP TYPE.
drop function if exists public.academy_instructor_create_program(
  text, public.academy_program_type, text, text, uuid, numeric
);
-- Older credential helpers declare local vars of academy_program_type.
drop function if exists public.academy_queue_completion_certificate(uuid, uuid);
drop function if exists public.academy_queue_completion_credential(uuid, uuid);

alter table public.academy_programs
  alter column type drop default;

-- Convert column only while it still uses the legacy enum.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'academy_programs'
      and column_name = 'type'
      and udt_name = 'academy_program_type'
  ) and exists (
    select 1 from pg_type where typname = 'academy_program_type_v2'
  ) then
    alter table public.academy_programs
      alter column type type public.academy_program_type_v2
      using (
        case type::text
          when 'cpa' then 'certification_program'::public.academy_program_type_v2
          when 'specialty_endorsement' then 'endorsement_program'::public.academy_program_type_v2
          when 'intelligent_coordination' then 'short_course'::public.academy_program_type_v2
          when 'professional_practice_accelerator' then 'course'::public.academy_program_type_v2
          when 'free_course' then 'course'::public.academy_program_type_v2
          when 'paid_course' then 'course'::public.academy_program_type_v2
          when 'short_course' then 'short_course'::public.academy_program_type_v2
          when 'course' then 'course'::public.academy_program_type_v2
          when 'certification_program' then 'certification_program'::public.academy_program_type_v2
          when 'endorsement_program' then 'endorsement_program'::public.academy_program_type_v2
          else 'course'::public.academy_program_type_v2
        end
      );
  end if;
end $$;

drop type if exists public.academy_program_type;

do $$
begin
  if exists (select 1 from pg_type where typname = 'academy_program_type_v2')
     and not exists (select 1 from pg_type where typname = 'academy_program_type') then
    alter type public.academy_program_type_v2 rename to academy_program_type;
  end if;
end $$;

alter table public.academy_programs
  alter column access set not null,
  alter column recognition set not null,
  alter column learning_path set not null,
  alter column access set default 'free'::public.academy_course_access,
  alter column recognition set default 'certificate_of_completion'::public.academy_course_recognition,
  alter column learning_path set default 'business_and_practice'::public.academy_learning_path,
  alter column type set default 'course'::public.academy_program_type;

-- Recreate instructor create RPC against the new enum (+ metadata defaults).
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
  v_access public.academy_course_access;
  v_recognition public.academy_course_recognition;
  v_learning_path public.academy_learning_path;
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

  v_access := case p_type
    when 'certification_program' then 'purchased'::public.academy_course_access
    when 'endorsement_program' then 'purchased'::public.academy_course_access
    when 'short_course' then 'free'::public.academy_course_access
    else 'free'::public.academy_course_access
  end;
  v_recognition := case p_type
    when 'certification_program' then 'professional_certification'::public.academy_course_recognition
    when 'endorsement_program' then 'specialty_endorsement'::public.academy_course_recognition
    else 'certificate_of_completion'::public.academy_course_recognition
  end;
  v_learning_path := case p_type
    when 'certification_program' then 'certification'::public.academy_learning_path
    when 'endorsement_program' then 'specialty'::public.academy_learning_path
    when 'short_course' then 'whitby'::public.academy_learning_path
    else 'business_and_practice'::public.academy_learning_path
  end;

  insert into public.academy_programs (
    name,
    type,
    access,
    recognition,
    learning_path,
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
    v_access,
    v_recognition,
    v_learning_path,
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
grant execute on function public.academy_instructor_create_program(
  text, public.academy_program_type, text, text, uuid, numeric
) to authenticated, service_role;

-- 5) Credential queue / award helpers: key off recognition ---------------------
create or replace function public.academy_credential_type_for_recognition(
  p_recognition public.academy_course_recognition
)
returns public.academy_credential_type
language sql
immutable
as $$
  select case p_recognition
    when 'professional_certification' then 'cpa_credential'::public.academy_credential_type
    when 'specialty_endorsement' then 'specialty_endorsement'::public.academy_credential_type
    else 'certificate_of_completion'::public.academy_credential_type
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
declare
  v_recognition public.academy_course_recognition;
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

  select p.recognition
  into v_recognition
  from public.academy_programs p
  where p.id = p_program_id;

  if v_recognition is null or v_recognition = 'none' then
    return;
  end if;

  v_credential_type := public.academy_credential_type_for_recognition(v_recognition);

  insert into public.academy_credentials (user_id, program_id, type, status)
  values (p_user_id, p_program_id, v_credential_type, 'credential_review');
end;
$$;

-- Primary credential queue path (assignment migration supersedes certificate queue).
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
  v_credential_type public.academy_credential_type;
  v_initial_status public.academy_credential_status;
  v_has_assignments boolean := false;
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

  select p.recognition
  into v_recognition
  from public.academy_programs p
  where p.id = p_program_id;

  if v_recognition is null or v_recognition = 'none' then
    return;
  end if;

  v_credential_type := public.academy_credential_type_for_recognition(v_recognition);

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

grant execute on function public.academy_credential_type_for_recognition(public.academy_course_recognition)
  to anon, authenticated, service_role;
