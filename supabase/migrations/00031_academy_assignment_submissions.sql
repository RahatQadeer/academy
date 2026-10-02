-- In-course assignment submissions, instructor grading, and certificate eligibility.
-- Academy-owned. Extends academy_assignments (00018) and credential progress (00027/00028).
-- Does not replace academy_applied_work_submissions (CPA credential-stage applied work).

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'academy_assignment_submission_status'
  ) then
    create type public.academy_assignment_submission_status as enum (
      'draft',
      'submitted',
      'graded',
      'resubmission_required'
    );
  end if;
end
$$;

create table if not exists public.academy_assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.academy_assignments (id) on delete cascade,
  lesson_id uuid not null references public.academy_lessons (id) on delete cascade,
  program_id uuid not null references public.academy_programs (id) on delete cascade,
  enrollment_id uuid not null references public.academy_enrollments (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status public.academy_assignment_submission_status not null default 'draft',
  body text not null default '',
  file_storage_path text,
  file_name text,
  score numeric(6, 2),
  max_score numeric(6, 2) not null default 100,
  feedback text not null default '',
  attempt_count integer not null default 0,
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id),
  constraint academy_assignment_submissions_score_range
    check (score is null or (score >= 0 and score <= max_score)),
  constraint academy_assignment_submissions_max_score_positive
    check (max_score > 0),
  constraint academy_assignment_submissions_attempts_nonnegative
    check (attempt_count >= 0)
);

create index if not exists academy_assignment_submissions_program_status_idx
  on public.academy_assignment_submissions (program_id, status, submitted_at desc);

create index if not exists academy_assignment_submissions_user_idx
  on public.academy_assignment_submissions (user_id, program_id);

create index if not exists academy_assignment_submissions_assignment_idx
  on public.academy_assignment_submissions (assignment_id, status);

alter table public.academy_assignment_submissions enable row level security;

drop policy if exists academy_assignment_submissions_select on public.academy_assignment_submissions;
create policy academy_assignment_submissions_select on public.academy_assignment_submissions
  for select using (
    public.has_academy_entitlement()
    and (
      user_id = auth.uid()
      or public.is_academy_admin()
      or public.academy_can_author_program(program_id)
    )
  );

-- Writes go through security-definer RPCs so learners cannot mark their own work graded.
grant select on public.academy_assignment_submissions to authenticated, service_role;
grant insert, update, delete on public.academy_assignment_submissions to service_role;

-- Required assignments = academy_assignments rows on lessons in the program.
create or replace function public.academy_program_required_assignment_ids(p_program_id uuid)
returns table (assignment_id uuid, lesson_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.lesson_id
  from public.academy_assignments a
  join public.academy_lessons l on l.id = a.lesson_id
  join public.academy_modules m on m.id = l.module_id
  where m.program_id = p_program_id;
$$;

create or replace function public.academy_assignment_counts_as_graded(
  p_assignment_id uuid,
  p_lesson_id uuid,
  p_user_id uuid,
  p_credential_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.academy_assignment_submissions s
      where s.assignment_id = p_assignment_id
        and s.user_id = p_user_id
        and s.status = 'graded'
    )
    or (
      p_credential_id is not null
      and exists (
        select 1
        from public.academy_applied_work_submissions w
        where w.credential_id = p_credential_id
          and w.lesson_id = p_lesson_id
          and w.user_id = p_user_id
          and w.status = 'approved'
      )
    );
$$;

create or replace function public.academy_program_assignment_stats(
  p_user_id uuid,
  p_program_id uuid,
  p_credential_id uuid default null
)
returns table (
  total integer,
  submitted integer,
  reviewed integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and auth.uid() is distinct from p_user_id
     and not public.is_academy_admin()
     and not public.academy_can_author_program(p_program_id) then
    return query select 0, 0, 0;
    return;
  end if;

  return query
  with required as (
    select assignment_id, lesson_id
    from public.academy_program_required_assignment_ids(p_program_id)
  ),
  rows as (
    select
      r.assignment_id,
      exists (
        select 1
        from public.academy_assignment_submissions s
        where s.assignment_id = r.assignment_id
          and s.user_id = p_user_id
          and s.status <> 'draft'
          and s.submitted_at is not null
      )
      or exists (
        select 1
        from public.academy_applied_work_submissions w
        where w.user_id = p_user_id
          and w.lesson_id = r.lesson_id
          and (p_credential_id is null or w.credential_id = p_credential_id)
          and w.status in ('submitted', 'under_review', 'approved', 'returned')
      ) as is_submitted,
      public.academy_assignment_counts_as_graded(
        r.assignment_id,
        r.lesson_id,
        p_user_id,
        p_credential_id
      ) as is_reviewed
    from required r
  )
  select
    (select count(*)::integer from required),
    (select count(*) filter (where is_submitted)::integer from rows),
    (select count(*) filter (where is_reviewed)::integer from rows);
end;
$$;

create or replace function public.academy_required_assignments_graded(
  p_user_id uuid,
  p_program_id uuid,
  p_credential_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select s.total = 0 or s.reviewed >= s.total
  from public.academy_program_assignment_stats(p_user_id, p_program_id, p_credential_id) s;
$$;

create or replace function public.academy_credential_assignments_ready(p_credential_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.academy_credentials%rowtype;
begin
  select * into v_row from public.academy_credentials where id = p_credential_id;
  if v_row.id is null then
    return false;
  end if;
  return public.academy_required_assignments_graded(v_row.user_id, v_row.program_id, v_row.id);
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
    from public.academy_program_required_assignment_ids(p_program_id)
  )
  into v_has_assignments;

  v_initial_status := case
    when v_has_assignments then 'applied_work'::public.academy_credential_status
    when v_credential_type = 'cpa_credential' then 'credential_review'::public.academy_credential_status
    else 'credential_review'::public.academy_credential_status
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
  v_reviewed_assignments integer := 0;
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
     and not public.is_academy_admin()
     and not public.academy_can_author_program(v_row.program_id) then
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

  select s.total, s.reviewed
  into v_total_assignments, v_reviewed_assignments
  from public.academy_program_assignment_stats(v_row.user_id, v_row.program_id, v_row.id) s;

  v_applied_complete := v_total_assignments = 0 or v_reviewed_assignments >= v_total_assignments;

  if v_row.type = 'certificate_of_completion' then
    v_next_status := case
      when not v_applied_complete then 'applied_work'::public.academy_credential_status
      else 'credential_review'::public.academy_credential_status
    end;
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

  v_learning_complete := v_total_lessons = 0 or v_completed_lessons >= v_total_lessons;
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

create or replace function public.academy_mark_assignment_lesson_complete(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into public.academy_lesson_progress (enrollment_id, lesson_id, status, completed_at)
  values (p_enrollment_id, p_lesson_id, 'completed', now())
  on conflict (enrollment_id, lesson_id) do update
  set
    status = case
      when academy_lesson_progress.status = 'locked' then academy_lesson_progress.status
      else 'completed'
    end,
    completed_at = coalesce(academy_lesson_progress.completed_at, now());

  perform public.academy_apply_enrollment_progress(p_enrollment_id);
end;
$$;

create or replace function public.academy_mirror_applied_work(
  p_user_id uuid,
  p_program_id uuid,
  p_lesson_id uuid,
  p_summary text,
  p_file_path text,
  p_status public.academy_applied_work_submission_status
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_credential_id uuid;
begin
  select c.id
  into v_credential_id
  from public.academy_credentials c
  where c.user_id = p_user_id
    and c.program_id = p_program_id
  order by c.awarded_at desc nulls last
  limit 1;

  if v_credential_id is null then
    return;
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
    v_credential_id,
    p_user_id,
    p_lesson_id,
    coalesce(nullif(trim(p_summary), ''), 'Assignment submission'),
    nullif(trim(coalesce(p_file_path, '')), ''),
    p_status
  )
  on conflict (credential_id, lesson_id) do update
  set
    summary = excluded.summary,
    document_storage_path = coalesce(
      excluded.document_storage_path,
      academy_applied_work_submissions.document_storage_path
    ),
    status = excluded.status,
    submitted_at = case
      when excluded.status in ('submitted', 'under_review') then now()
      else academy_applied_work_submissions.submitted_at
    end,
    reviewed_at = case
      when excluded.status in ('approved', 'returned') then now()
      else academy_applied_work_submissions.reviewed_at
    end,
    updated_at = now();
end;
$$;

create or replace function public.academy_save_assignment_draft(
  p_assignment_id uuid,
  p_body text,
  p_file_storage_path text default null,
  p_file_name text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_assignment public.academy_assignments%rowtype;
  v_program_id uuid;
  v_enrollment public.academy_enrollments%rowtype;
  v_existing public.academy_assignment_submissions%rowtype;
  v_body text := left(trim(coalesce(p_body, '')), 20000);
  v_path text := nullif(trim(coalesce(p_file_storage_path, '')), '');
  v_name text := left(trim(coalesce(p_file_name, '')), 240);
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthenticated');
  end if;
  if not public.has_academy_entitlement() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'no_academy_access');
  end if;
  if not public.has_academy_role('learner') and not public.is_academy_admin() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'no_learner_capability');
  end if;

  select * into v_assignment from public.academy_assignments where id = p_assignment_id;
  if v_assignment.id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  v_program_id := public.academy_program_id_from_lesson(v_assignment.lesson_id);
  if v_program_id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  select * into v_enrollment
  from public.academy_enrollments
  where user_id = auth.uid()
    and program_id = v_program_id
  order by enrolled_at desc
  limit 1;

  if v_enrollment.id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'no_enrollment');
  end if;

  if v_path is not null and v_path not like ('assignment-submissions/' || auth.uid()::text || '/%') then
    return jsonb_build_object('status', 'unavailable', 'reason', 'invalid_file');
  end if;

  select * into v_existing
  from public.academy_assignment_submissions
  where assignment_id = p_assignment_id
    and user_id = auth.uid();

  if v_existing.id is not null and v_existing.status in ('submitted', 'graded') then
    return jsonb_build_object('status', 'unavailable', 'reason', 'already_submitted');
  end if;

  insert into public.academy_assignment_submissions (
    assignment_id,
    lesson_id,
    program_id,
    enrollment_id,
    user_id,
    status,
    body,
    file_storage_path,
    file_name
  )
  values (
    p_assignment_id,
    v_assignment.lesson_id,
    v_program_id,
    v_enrollment.id,
    auth.uid(),
    'draft',
    v_body,
    v_path,
    nullif(v_name, '')
  )
  on conflict (assignment_id, user_id) do update
  set
    body = excluded.body,
    file_storage_path = coalesce(excluded.file_storage_path, academy_assignment_submissions.file_storage_path),
    file_name = coalesce(excluded.file_name, academy_assignment_submissions.file_name),
    status = case
      when academy_assignment_submissions.status = 'resubmission_required'
        then 'resubmission_required'::public.academy_assignment_submission_status
      else 'draft'::public.academy_assignment_submission_status
    end,
    updated_at = now();

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.academy_submit_assignment(
  p_assignment_id uuid,
  p_body text,
  p_file_storage_path text default null,
  p_file_name text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_assignment public.academy_assignments%rowtype;
  v_program_id uuid;
  v_enrollment public.academy_enrollments%rowtype;
  v_existing public.academy_assignment_submissions%rowtype;
  v_body text := left(trim(coalesce(p_body, '')), 20000);
  v_path text := nullif(trim(coalesce(p_file_storage_path, '')), '');
  v_name text := left(trim(coalesce(p_file_name, '')), 240);
  v_credential_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthenticated');
  end if;
  if not public.has_academy_entitlement() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'no_academy_access');
  end if;
  if not public.has_academy_role('learner') and not public.is_academy_admin() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'no_learner_capability');
  end if;

  select * into v_assignment from public.academy_assignments where id = p_assignment_id;
  if v_assignment.id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  v_program_id := public.academy_program_id_from_lesson(v_assignment.lesson_id);
  if v_program_id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  select * into v_enrollment
  from public.academy_enrollments
  where user_id = auth.uid()
    and program_id = v_program_id
  order by enrolled_at desc
  limit 1;

  if v_enrollment.id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'no_enrollment');
  end if;

  if v_path is not null and v_path not like ('assignment-submissions/' || auth.uid()::text || '/%') then
    return jsonb_build_object('status', 'unavailable', 'reason', 'invalid_file');
  end if;

  select * into v_existing
  from public.academy_assignment_submissions
  where assignment_id = p_assignment_id
    and user_id = auth.uid()
  for update;

  if v_existing.id is not null and v_existing.status in ('submitted', 'graded') then
    return jsonb_build_object('status', 'unavailable', 'reason', 'already_submitted');
  end if;

  if v_body = '' and v_path is null then
    if v_existing.id is null or coalesce(v_existing.file_storage_path, '') = '' then
      return jsonb_build_object('status', 'unavailable', 'reason', 'empty');
    end if;
  end if;

  insert into public.academy_assignment_submissions (
    assignment_id,
    lesson_id,
    program_id,
    enrollment_id,
    user_id,
    status,
    body,
    file_storage_path,
    file_name,
    attempt_count,
    submitted_at
  )
  values (
    p_assignment_id,
    v_assignment.lesson_id,
    v_program_id,
    v_enrollment.id,
    auth.uid(),
    'submitted',
    v_body,
    v_path,
    nullif(v_name, ''),
    1,
    now()
  )
  on conflict (assignment_id, user_id) do update
  set
    body = excluded.body,
    file_storage_path = coalesce(excluded.file_storage_path, academy_assignment_submissions.file_storage_path),
    file_name = coalesce(excluded.file_name, academy_assignment_submissions.file_name),
    status = 'submitted',
    attempt_count = academy_assignment_submissions.attempt_count + 1,
    submitted_at = now(),
    updated_at = now();

  perform public.academy_mark_assignment_lesson_complete(v_enrollment.id, v_assignment.lesson_id);
  perform public.academy_mirror_applied_work(
    auth.uid(),
    v_program_id,
    v_assignment.lesson_id,
    v_body,
    v_path,
    'submitted'
  );

  select c.id
  into v_credential_id
  from public.academy_credentials c
  where c.user_id = auth.uid()
    and c.program_id = v_program_id
  limit 1;

  if v_credential_id is not null then
    perform public.academy_sync_credential_progress(v_credential_id);
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.academy_grade_assignment(
  p_submission_id uuid,
  p_score numeric,
  p_feedback text default '',
  p_max_score numeric default 100
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.academy_assignment_submissions%rowtype;
  v_feedback text := left(trim(coalesce(p_feedback, '')), 8000);
  v_max numeric := coalesce(p_max_score, 100);
  v_credential_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthenticated');
  end if;
  if not public.has_academy_entitlement() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthorized');
  end if;
  if v_max <= 0 or v_max > 1000 then
    return jsonb_build_object('status', 'unavailable', 'reason', 'invalid_score');
  end if;
  if p_score is null or p_score < 0 or p_score > v_max then
    return jsonb_build_object('status', 'unavailable', 'reason', 'invalid_score');
  end if;

  select * into v_row
  from public.academy_assignment_submissions
  where id = p_submission_id
  for update;

  if v_row.id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  if not (public.is_academy_admin() or public.academy_can_author_program(v_row.program_id)) then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthorized');
  end if;

  if v_row.status not in ('submitted', 'graded', 'resubmission_required') then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_ready');
  end if;

  update public.academy_assignment_submissions
  set
    status = 'graded',
    score = p_score,
    max_score = v_max,
    feedback = v_feedback,
    graded_at = now(),
    graded_by_user_id = auth.uid(),
    updated_at = now()
  where id = p_submission_id;

  perform public.academy_mirror_applied_work(
    v_row.user_id,
    v_row.program_id,
    v_row.lesson_id,
    v_row.body,
    v_row.file_storage_path,
    'approved'
  );

  select c.id
  into v_credential_id
  from public.academy_credentials c
  where c.user_id = v_row.user_id
    and c.program_id = v_row.program_id
  limit 1;

  if v_credential_id is not null then
    perform public.academy_sync_credential_progress(v_credential_id);
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.academy_request_assignment_resubmission(
  p_submission_id uuid,
  p_feedback text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.academy_assignment_submissions%rowtype;
  v_feedback text := left(trim(coalesce(p_feedback, '')), 8000);
  v_credential_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthenticated');
  end if;
  if not public.has_academy_entitlement() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthorized');
  end if;
  if v_feedback = '' then
    return jsonb_build_object('status', 'unavailable', 'reason', 'feedback_required');
  end if;

  select * into v_row
  from public.academy_assignment_submissions
  where id = p_submission_id
  for update;

  if v_row.id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  if not (public.is_academy_admin() or public.academy_can_author_program(v_row.program_id)) then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthorized');
  end if;

  if v_row.status not in ('submitted', 'graded') then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_ready');
  end if;

  update public.academy_assignment_submissions
  set
    status = 'resubmission_required',
    feedback = v_feedback,
    graded_at = now(),
    graded_by_user_id = auth.uid(),
    updated_at = now()
  where id = p_submission_id;

  perform public.academy_mirror_applied_work(
    v_row.user_id,
    v_row.program_id,
    v_row.lesson_id,
    v_row.body,
    v_row.file_storage_path,
    'returned'
  );

  select c.id
  into v_credential_id
  from public.academy_credentials c
  where c.user_id = v_row.user_id
    and c.program_id = v_row.program_id
  limit 1;

  if v_credential_id is not null then
    perform public.academy_sync_credential_progress(v_credential_id);
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.academy_author_learner_identities(p_user_ids uuid[])
returns table (
  id uuid,
  preferred_name text,
  full_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_academy_entitlement() then
    return;
  end if;
  if not (public.is_academy_admin() or public.is_academy_instructor()) then
    return;
  end if;
  if p_user_ids is null or coalesce(array_length(p_user_ids, 1), 0) = 0 then
    return;
  end if;

  return query
  select u.id, u.preferred_name, u.full_name, u.email
  from public.users u
  where u.id = any (p_user_ids[1:80])
    and (
      public.is_academy_admin()
      or exists (
        select 1
        from public.academy_assignment_submissions s
        where s.user_id = u.id
          and public.academy_can_author_program(s.program_id)
      )
    )
  limit 80;
end;
$$;

revoke all on function public.academy_program_required_assignment_ids(uuid) from public, anon;
revoke all on function public.academy_assignment_counts_as_graded(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.academy_program_assignment_stats(uuid, uuid, uuid) from public, anon;
revoke all on function public.academy_required_assignments_graded(uuid, uuid, uuid) from public, anon;
revoke all on function public.academy_credential_assignments_ready(uuid) from public, anon;
revoke all on function public.academy_mark_assignment_lesson_complete(uuid, uuid) from public, anon, authenticated;
revoke all on function public.academy_mirror_applied_work(uuid, uuid, uuid, text, text, public.academy_applied_work_submission_status) from public, anon, authenticated;
revoke all on function public.academy_save_assignment_draft(uuid, text, text, text) from public, anon;
revoke all on function public.academy_submit_assignment(uuid, text, text, text) from public, anon;
revoke all on function public.academy_grade_assignment(uuid, numeric, text, numeric) from public, anon;
revoke all on function public.academy_request_assignment_resubmission(uuid, text) from public, anon;
revoke all on function public.academy_author_learner_identities(uuid[]) from public, anon;

grant execute on function public.academy_program_assignment_stats(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.academy_required_assignments_graded(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.academy_credential_assignments_ready(uuid) to authenticated, service_role;
grant execute on function public.academy_save_assignment_draft(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.academy_submit_assignment(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.academy_grade_assignment(uuid, numeric, text, numeric) to authenticated, service_role;
grant execute on function public.academy_request_assignment_resubmission(uuid, text) to authenticated, service_role;
grant execute on function public.academy_author_learner_identities(uuid[]) to authenticated, service_role;
grant execute on function public.academy_sync_credential_progress(uuid) to authenticated, service_role;
