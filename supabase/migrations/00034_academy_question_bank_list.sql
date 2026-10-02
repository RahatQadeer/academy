-- Paginated question bank list — one round trip for rows, totals, and filter metadata.

create index if not exists academy_questions_quiz_id_type_idx
  on public.academy_questions (quiz_id, type);

create or replace function public.academy_list_question_bank(
  p_scope text default 'admin',
  p_search text default '',
  p_type text default 'all',
  p_program_id uuid default null,
  p_module_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_search text := nullif(trim(p_search), '');
  v_type text := coalesce(nullif(trim(p_type), ''), 'all');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset integer;
begin
  if v_user_id is null then
    return null;
  end if;

  if not public.has_academy_entitlement() then
    return null;
  end if;

  if p_scope = 'admin' and not public.is_academy_admin() then
    return null;
  end if;

  if p_scope = 'instructor' and not public.is_academy_instructor() then
    return null;
  end if;

  if v_type not in ('all', 'multiple_choice', 'true_false') then
    v_type := 'all';
  end if;

  v_offset := (v_page - 1) * v_page_size;

  return (
    with accessible_programs as (
      select p.id, p.name
      from public.academy_programs p
      where (
        p_scope = 'admin'
        and public.is_academy_admin()
      )
      or (
        p_scope = 'instructor'
        and public.is_academy_instructor()
        and (
          public.is_assigned_instructor(p.id)
          or p.created_by_user_id = v_user_id
        )
      )
    ),
    accessible_modules as (
      select m.id, m.title, m.program_id, m.sort_order
      from public.academy_modules m
      join accessible_programs ap on ap.id = m.program_id
      where (p_program_id is null or m.program_id = p_program_id)
    ),
    scoped_modules as (
      select *
      from accessible_modules
      where (p_module_id is null or id = p_module_id)
    ),
    question_rows as (
      select
        q.id,
        q.quiz_id,
        q.question_text,
        q.type,
        q.sort_order,
        case
          when q.type = 'true_false' then 2
          else coalesce(jsonb_array_length(q.options), 0)
        end as option_count,
        ap.id as program_id,
        ap.name as program_name,
        m.id as module_id,
        m.title as module_title,
        l.id as lesson_id,
        l.title as lesson_title
      from public.academy_questions q
      join public.academy_quizzes qz on qz.id = q.quiz_id
      join public.academy_lessons l on l.id = qz.lesson_id and l.type = 'quiz'
      join scoped_modules m on m.id = l.module_id
      join accessible_programs ap on ap.id = m.program_id
      where (v_type = 'all' or q.type = v_type)
        and (
          v_search is null
          or q.question_text ilike ('%' || v_search || '%')
          or l.title ilike ('%' || v_search || '%')
          or m.title ilike ('%' || v_search || '%')
          or ap.name ilike ('%' || v_search || '%')
        )
    ),
    summary as (
      select
        count(*)::integer as total,
        count(*) filter (where type = 'multiple_choice')::integer as multiple_choice,
        count(*) filter (where type = 'true_false')::integer as true_false,
        count(distinct program_id)::integer as program_count
      from question_rows
    ),
    paged as (
      select *
      from question_rows
      order by program_name, module_title, lesson_title, sort_order
      offset v_offset
      limit v_page_size
    )
    select jsonb_build_object(
      'items',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'questionText', p.question_text,
              'type', p.type,
              'optionCount', p.option_count,
              'programId', p.program_id,
              'programName', p.program_name,
              'moduleId', p.module_id,
              'moduleTitle', p.module_title,
              'lessonId', p.lesson_id,
              'lessonTitle', p.lesson_title,
              'quizId', p.quiz_id,
              'sortOrder', p.sort_order
            )
            order by p.program_name, p.module_title, p.lesson_title, p.sort_order
          )
          from paged p
        ),
        '[]'::jsonb
      ),
      'total', (select total from summary),
      'page', v_page,
      'pageSize', v_page_size,
      'summary', (
        select jsonb_build_object(
          'total', s.total,
          'multipleChoice', s.multiple_choice,
          'trueFalse', s.true_false,
          'programCount', s.program_count
        )
        from summary s
      ),
      'programs', coalesce(
        (
          select jsonb_agg(jsonb_build_object('id', ap.id, 'name', ap.name) order by ap.name)
          from accessible_programs ap
        ),
        '[]'::jsonb
      ),
      'modules', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('id', m.id, 'title', m.title, 'programId', m.program_id)
            order by m.sort_order, m.title
          )
          from accessible_modules m
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

grant execute on function public.academy_list_question_bank(text, text, text, uuid, uuid, integer, integer)
  to authenticated, service_role;
