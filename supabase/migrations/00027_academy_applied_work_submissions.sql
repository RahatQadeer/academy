-- Applied work submissions for credential progress (CPA applied-work stage).
-- Academy-owned. Extends 00026.

create type public.academy_applied_work_submission_status as enum (
  'submitted',
  'under_review',
  'approved',
  'returned'
);

create table public.academy_applied_work_submissions (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.academy_credentials(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
  summary text not null default '',
  document_storage_path text,
  status public.academy_applied_work_submission_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (credential_id, lesson_id)
);

create index academy_applied_work_submissions_credential_idx
  on public.academy_applied_work_submissions (credential_id);

alter table public.academy_applied_work_submissions enable row level security;

create policy academy_applied_work_submissions_select on public.academy_applied_work_submissions
  for select using (
    public.has_academy_entitlement()
    and (user_id = auth.uid() or public.is_academy_admin())
  );

create policy academy_applied_work_submissions_insert on public.academy_applied_work_submissions
  for insert with check (
    public.has_academy_entitlement()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.academy_credentials c
      where c.id = credential_id
        and c.user_id = auth.uid()
    )
  );

create policy academy_applied_work_submissions_admin_write on public.academy_applied_work_submissions
  for update using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  )
  with check (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

-- Set CPA credentials to applied_work when the program has assignment lessons.
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

  select exists (
    select 1
    from public.academy_lessons l
    join public.academy_modules m on m.id = l.module_id
    where m.program_id = p_program_id
      and l.type = 'assignment'
  )
  into v_has_assignments;

  v_initial_status := case
    when v_credential_type = 'cpa_credential' and v_has_assignments then
      'applied_work'::public.academy_credential_status
    else
      'credential_review'::public.academy_credential_status
  end;

  insert into public.academy_credentials (user_id, program_id, type, status)
  values (p_user_id, p_program_id, v_credential_type, v_initial_status);
end;
$$;

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

create or replace function public.academy_submit_applied_work(
  p_credential_id uuid,
  p_lesson_id uuid,
  p_summary text,
  p_document_storage_path text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_credential public.academy_credentials%rowtype;
  v_summary text := trim(coalesce(p_summary, ''));
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthenticated');
  end if;
  if not public.has_academy_entitlement() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'no_academy_access');
  end if;
  if v_summary = '' then
    return jsonb_build_object('status', 'unavailable', 'reason', 'summary_required');
  end if;

  select *
  into v_credential
  from public.academy_credentials
  where id = p_credential_id;

  if v_credential.id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  if v_credential.user_id is distinct from auth.uid() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthorized');
  end if;

  if v_credential.status not in ('applied_work', 'required_learning') then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_accepting_submissions');
  end if;

  if not exists (
    select 1
    from public.academy_lessons l
    join public.academy_modules m on m.id = l.module_id
    where l.id = p_lesson_id
      and m.program_id = v_credential.program_id
      and l.type = 'assignment'
  ) then
    return jsonb_build_object('status', 'unavailable', 'reason', 'invalid_lesson');
  end if;

  insert into public.academy_applied_work_submissions (
    credential_id,
    user_id,
    lesson_id,
    summary,
    document_storage_path,
    status
  )
  values (
    p_credential_id,
    auth.uid(),
    p_lesson_id,
    v_summary,
    nullif(trim(coalesce(p_document_storage_path, '')), ''),
    'submitted'
  )
  on conflict (credential_id, lesson_id) do update
  set
    summary = excluded.summary,
    document_storage_path = coalesce(excluded.document_storage_path, academy_applied_work_submissions.document_storage_path),
    status = case
      when academy_applied_work_submissions.status = 'approved' then academy_applied_work_submissions.status
      else 'submitted'::public.academy_applied_work_submission_status
    end,
    submitted_at = now(),
    updated_at = now();

  perform public.academy_sync_credential_progress(p_credential_id);

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.academy_sync_credential_progress(uuid) from public, anon, authenticated;
revoke all on function public.academy_submit_applied_work(uuid, uuid, text, text) from public, anon;

grant execute on function public.academy_sync_credential_progress(uuid) to authenticated, service_role;
grant execute on function public.academy_submit_applied_work(uuid, uuid, text, text) to authenticated, service_role;

create or replace function public.academy_approve_applied_work_submission(
  p_submission_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_submission public.academy_applied_work_submissions%rowtype;
begin
  if not (public.has_academy_entitlement() and public.is_academy_admin()) then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthorized');
  end if;

  select *
  into v_submission
  from public.academy_applied_work_submissions
  where id = p_submission_id
  for update;

  if v_submission.id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  update public.academy_applied_work_submissions
  set
    status = 'approved',
    reviewed_at = now(),
    updated_at = now()
  where id = p_submission_id;

  perform public.academy_sync_credential_progress(v_submission.credential_id);

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.academy_approve_applied_work_submission(uuid) from public, anon;
grant execute on function public.academy_approve_applied_work_submission(uuid) to authenticated, service_role;
