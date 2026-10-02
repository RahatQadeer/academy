-- Academy learner quiz access (PA-ACA-009).
-- Academy-owned. Does not alter 00001–00011.
--
-- academy_questions.correct_answer must remain unreadable to learners.
-- These functions return only a safe projection or a safe score result.
-- They never return correct_answer.

create or replace function public.academy_question_choice_ids(
  p_type text,
  p_options jsonb
)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  ids text[] := '{}';
  elem jsonb;
  k text;
  extracted text;
begin
  if p_type = 'true_false' and (
    p_options is null
    or p_options = 'null'::jsonb
    or p_options = '[]'::jsonb
  ) then
    return array['true', 'false'];
  end if;

  if jsonb_typeof(p_options) = 'array' then
    for elem in select value from jsonb_array_elements(p_options)
    loop
      if jsonb_typeof(elem) = 'string' then
        ids := ids || array[elem #>> '{}'];
      elsif jsonb_typeof(elem) = 'object' then
        extracted := coalesce(elem->>'id', elem->>'value', elem->>'label');
        if extracted is not null then
          ids := ids || array[extracted];
        end if;
      end if;
    end loop;
  elsif jsonb_typeof(p_options) = 'object' then
    for k in select jsonb_object_keys(p_options)
    loop
      ids := ids || array[k];
    end loop;
  end if;

  if p_type = 'true_false' and coalesce(array_length(ids, 1), 0) = 0 then
    return array['true', 'false'];
  end if;

  return ids;
end;
$$;

create or replace function public.academy_learner_quiz_access_reason(
  p_program_id uuid,
  p_lesson_id uuid,
  p_quiz_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enrollment_id uuid;
begin
  if auth.uid() is null then
    return 'unauthenticated';
  end if;
  if not public.has_academy_entitlement() then
    return 'no_academy_access';
  end if;
  if not public.has_academy_role('learner') then
    return 'no_learner_capability';
  end if;
  if not exists (
    select 1
    from public.academy_programs
    where id = p_program_id
      and status = 'published'
  ) then
    return 'not_found';
  end if;
  if not exists (
    select 1
    from public.academy_quizzes q
    join public.academy_lessons l on l.id = q.lesson_id
    join public.academy_modules m on m.id = l.module_id
    where q.id = p_quiz_id
      and l.id = p_lesson_id
      and m.program_id = p_program_id
      and l.type = 'quiz'
  ) then
    return 'mismatch';
  end if;

  select e.id
  into v_enrollment_id
  from public.academy_enrollments e
  where e.user_id = auth.uid()
    and e.program_id = p_program_id;

  if v_enrollment_id is null then
    return 'no_enrollment';
  end if;

  if exists (
    select 1
    from public.academy_lesson_progress p
    where p.enrollment_id = v_enrollment_id
      and p.lesson_id = p_lesson_id
      and p.status = 'locked'
  ) then
    return 'locked';
  end if;

  return null;
end;
$$;

create or replace function public.academy_learner_quiz_questions(
  p_program_id uuid,
  p_lesson_id uuid,
  p_quiz_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  v_reason := public.academy_learner_quiz_access_reason(p_program_id, p_lesson_id, p_quiz_id);
  if v_reason is not null then
    return jsonb_build_object('status', 'unavailable', 'reason', v_reason);
  end if;

  if exists (
    select 1
    from public.academy_questions q
    where q.quiz_id = p_quiz_id
      and q.type not in ('multiple_choice', 'true_false')
  ) then
    return jsonb_build_object('status', 'unavailable', 'reason', 'malformed');
  end if;

  if exists (
    select 1
    from public.academy_questions q
    where q.quiz_id = p_quiz_id
      and q.type = 'multiple_choice'
      and coalesce(array_length(public.academy_question_choice_ids(q.type, q.options), 1), 0) < 2
  ) then
    return jsonb_build_object('status', 'unavailable', 'reason', 'malformed');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'questions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'question_text', q.question_text,
            'type', q.type,
            'options', q.options,
            'sort_order', q.sort_order
          )
          order by q.sort_order, q.id
        )
        from public.academy_questions q
        where q.quiz_id = p_quiz_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.academy_submit_learner_quiz(
  p_program_id uuid,
  p_lesson_id uuid,
  p_quiz_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_reason text;
  v_enrollment_id uuid;
  v_passing_score integer;
  v_total integer := 0;
  v_correct integer := 0;
  v_score integer := 0;
  v_passed boolean := false;
  v_question record;
  v_submitted jsonb;
  v_answer text;
  v_seen uuid[] := '{}';
  v_choice_ids text[];
  v_item_results jsonb := '[]'::jsonb;
  v_submitted_count integer;
begin
  v_reason := public.academy_learner_quiz_access_reason(p_program_id, p_lesson_id, p_quiz_id);
  if v_reason is not null then
    return jsonb_build_object('status', 'unavailable', 'reason', v_reason);
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    return jsonb_build_object('status', 'unavailable', 'reason', 'invalid');
  end if;

  select q.passing_score
  into v_passing_score
  from public.academy_quizzes q
  where q.id = p_quiz_id;

  if v_passing_score is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  if exists (
    select 1
    from public.academy_questions q
    where q.quiz_id = p_quiz_id
      and q.type not in ('multiple_choice', 'true_false')
  ) then
    return jsonb_build_object('status', 'unavailable', 'reason', 'malformed');
  end if;

  select count(*)::integer
  into v_total
  from public.academy_questions q
  where q.quiz_id = p_quiz_id;

  if v_total = 0 then
    return jsonb_build_object('status', 'unavailable', 'reason', 'empty');
  end if;

  select count(*)::integer
  into v_submitted_count
  from jsonb_array_elements(p_answers) elem
  where nullif(trim(both from coalesce(elem->>'question_id', '')), '') is not null;

  if v_submitted_count <> jsonb_array_length(p_answers)
    or v_submitted_count <> v_total
    or (
      select count(distinct elem->>'question_id')
      from jsonb_array_elements(p_answers) elem
    ) <> v_total
  then
    return jsonb_build_object('status', 'unavailable', 'reason', 'invalid');
  end if;

  for v_question in
    select q.id, q.type, q.options, q.correct_answer
    from public.academy_questions q
    where q.quiz_id = p_quiz_id
    order by q.sort_order, q.id
  loop
    if v_question.id = any (v_seen) then
      return jsonb_build_object('status', 'unavailable', 'reason', 'invalid');
    end if;
    v_seen := v_seen || v_question.id;

    select elem
    into v_submitted
    from jsonb_array_elements(p_answers) elem
    where (elem->>'question_id') = v_question.id::text;

    if v_submitted is null then
      return jsonb_build_object('status', 'unavailable', 'reason', 'invalid');
    end if;

    v_answer := trim(both from coalesce(v_submitted->>'answer', ''));
    if v_answer = '' then
      return jsonb_build_object('status', 'unavailable', 'reason', 'invalid');
    end if;

    v_choice_ids := public.academy_question_choice_ids(v_question.type, v_question.options);
    if coalesce(array_length(v_choice_ids, 1), 0) = 0 then
      return jsonb_build_object('status', 'unavailable', 'reason', 'malformed');
    end if;

    if not exists (
      select 1
      from unnest(v_choice_ids) as choice(id)
      where lower(trim(both from choice.id)) = lower(v_answer)
    ) then
      return jsonb_build_object('status', 'unavailable', 'reason', 'invalid');
    end if;

    if lower(trim(both from coalesce(v_question.correct_answer, ''))) = lower(v_answer) then
      v_correct := v_correct + 1;
      v_item_results := v_item_results || jsonb_build_array(
        jsonb_build_object('question_id', v_question.id, 'correct', true)
      );
    else
      v_item_results := v_item_results || jsonb_build_array(
        jsonb_build_object('question_id', v_question.id, 'correct', false)
      );
    end if;
  end loop;

  -- Reject extra IDs that do not belong to this quiz.
  if exists (
    select 1
    from jsonb_array_elements(p_answers) elem
    where not exists (
      select 1
      from public.academy_questions q
      where q.quiz_id = p_quiz_id
        and q.id::text = elem->>'question_id'
    )
  ) then
    return jsonb_build_object('status', 'unavailable', 'reason', 'invalid');
  end if;

  v_score := round((v_correct::numeric * 100) / v_total::numeric)::integer;
  v_passed := v_score >= v_passing_score;

  if v_passed then
    select e.id
    into v_enrollment_id
    from public.academy_enrollments e
    where e.user_id = auth.uid()
      and e.program_id = p_program_id;

    insert into public.academy_lesson_progress (
      enrollment_id,
      lesson_id,
      status,
      completed_at
    )
    values (
      v_enrollment_id,
      p_lesson_id,
      'completed',
      now()
    )
    on conflict (enrollment_id, lesson_id) do update
    set
      status = 'completed',
      completed_at = coalesce(public.academy_lesson_progress.completed_at, excluded.completed_at)
    where public.academy_lesson_progress.status is distinct from 'locked';
  end if;

  return jsonb_build_object(
    'status', 'scored',
    'score', v_score,
    'passed', v_passed,
    'total_questions', v_total,
    'correct_answers', v_correct,
    'passing_score', v_passing_score,
    'item_results', v_item_results
  );
end;
$$;

revoke all on function public.academy_question_choice_ids(text, jsonb) from public, anon, authenticated;
revoke all on function public.academy_learner_quiz_access_reason(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.academy_learner_quiz_questions(uuid, uuid, uuid) from public, anon;
revoke all on function public.academy_submit_learner_quiz(uuid, uuid, uuid, jsonb) from public, anon;

grant execute on function public.academy_learner_quiz_questions(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.academy_submit_learner_quiz(uuid, uuid, uuid, jsonb) to authenticated, service_role;
