-- Faster Library / Custom switches: skip expensive quiz / assignment / exercise
-- scans when status=custom, and skip library rows when status=in_quiz.

drop function if exists public.academy_list_question_bank(text, text, text, uuid, uuid, integer, integer);

create or replace function public.academy_list_question_bank(
  p_scope text default 'admin',
  p_search text default '',
  p_type text default 'all',
  p_program_id uuid default null,
  p_module_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 25,
  p_status text default 'all'
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
  v_status text := coalesce(nullif(trim(p_status), ''), 'all');
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

  if v_type not in (
    'all',
    'multiple_choice',
    'true_false',
    'exercise',
    'assignment',
    'other'
  ) then
    v_type := 'all';
  end if;

  if v_status not in ('all', 'custom', 'in_quiz') then
    v_status := 'all';
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
    all_modules as (
      select m.id, m.title, m.program_id, m.sort_order
      from public.academy_modules m
      join accessible_programs ap on ap.id = m.program_id
    ),
    accessible_modules as (
      select *
      from all_modules
      where (p_program_id is null or program_id = p_program_id)
    ),
    quiz_rows as (
      select
        q.id,
        q.quiz_id,
        q.question_text,
        case
          when q.type in ('multiple_choice', 'true_false', 'exercise', 'assignment', 'other') then q.type
          else 'other'
        end as type,
        q.sort_order,
        case
          when q.type = 'true_false' then 2
          when jsonb_typeof(q.options) = 'array' then coalesce(jsonb_array_length(q.options), 0)
          else 0
        end as option_count,
        ap.id as program_id,
        ap.name as program_name,
        m.id as module_id,
        m.title as module_title,
        m.sort_order as module_sort,
        l.id as lesson_id,
        l.title as lesson_title,
        l.type::text as lesson_type,
        l.sort_order as lesson_sort,
        false as custom
      from public.academy_questions q
      join public.academy_quizzes qz on qz.id = q.quiz_id
      join public.academy_lessons l on l.id = qz.lesson_id
      join all_modules m on m.id = l.module_id
      join accessible_programs ap on ap.id = m.program_id
      where v_status in ('all', 'in_quiz')
    ),
    library_rows as (
      select
        q.id,
        q.quiz_id,
        q.question_text,
        case
          when q.type in ('multiple_choice', 'true_false', 'exercise', 'assignment', 'other') then q.type
          else 'other'
        end as type,
        q.sort_order,
        case
          when q.type = 'true_false' then 2
          when jsonb_typeof(q.options) = 'array' then coalesce(jsonb_array_length(q.options), 0)
          else 0
        end as option_count,
        ap.id as program_id,
        ap.name as program_name,
        null::uuid as module_id,
        'Custom'::text as module_title,
        -1 as module_sort,
        null::uuid as lesson_id,
        'Saved for later'::text as lesson_title,
        'bank'::text as lesson_type,
        0 as lesson_sort,
        true as custom
      from public.academy_questions q
      join accessible_programs ap on ap.id = q.program_id
      where v_status in ('all', 'custom')
        and q.quiz_id is null
        and q.program_id is not null
    ),
    assignment_rows as (
      select
        a.id,
        null::uuid as quiz_id,
        coalesce(nullif(btrim(a.brief), ''), l.title) as question_text,
        'assignment'::text as type,
        0 as sort_order,
        0 as option_count,
        ap.id as program_id,
        ap.name as program_name,
        m.id as module_id,
        m.title as module_title,
        m.sort_order as module_sort,
        l.id as lesson_id,
        l.title as lesson_title,
        l.type::text as lesson_type,
        l.sort_order as lesson_sort,
        false as custom
      from public.academy_assignments a
      join public.academy_lessons l on l.id = a.lesson_id
      join all_modules m on m.id = l.module_id
      join accessible_programs ap on ap.id = m.program_id
      where v_status in ('all', 'in_quiz')
    ),
    exercise_rows as (
      select
        (
          substr(md5(scoped.id::text || E'\n' || prompts.prompt), 1, 8) || '-' ||
          substr(md5(scoped.id::text || E'\n' || prompts.prompt), 9, 4) || '-4' ||
          substr(md5(scoped.id::text || E'\n' || prompts.prompt), 13, 3) || '-a' ||
          substr(md5(scoped.id::text || E'\n' || prompts.prompt), 17, 3) || '-' ||
          substr(md5(scoped.id::text || E'\n' || prompts.prompt), 21, 12)
        )::uuid as id,
        null::uuid as quiz_id,
        prompts.prompt as question_text,
        'exercise'::text as type,
        prompts.ord::integer as sort_order,
        0 as option_count,
        scoped.program_id,
        scoped.program_name,
        scoped.module_id,
        scoped.module_title,
        scoped.module_sort,
        scoped.id as lesson_id,
        scoped.title as lesson_title,
        scoped.lesson_type,
        scoped.lesson_sort,
        false as custom
      from (
        select
          l.id,
          l.title,
          l.type::text as lesson_type,
          l.sort_order as lesson_sort,
          l.content_body,
          ap.id as program_id,
          ap.name as program_name,
          m.id as module_id,
          m.title as module_title,
          m.sort_order as module_sort
        from public.academy_lessons l
        join all_modules m on m.id = l.module_id
        join accessible_programs ap on ap.id = m.program_id
        where v_status in ('all', 'in_quiz')
          and coalesce(l.content_body, '') ~* '```exercise'
      ) scoped
      cross join lateral (
        select
          trim(both from rm.matches[1]) as prompt,
          rm.ord
        from regexp_matches(
          coalesce(scoped.content_body, ''),
          E'(?mi)^PROMPT:\\s*(.+)$',
          'g'
        ) with ordinality as rm(matches, ord)
        where trim(both from rm.matches[1]) <> ''
      ) prompts
    ),
    catalog_rows as (
      select *
      from (
        select * from library_rows
        union all
        select * from quiz_rows
        union all
        select * from assignment_rows
        union all
        select * from exercise_rows
      ) combined
      where (
          v_type = 'all'
          or combined.type = v_type
          or (v_type = 'other' and combined.type not in (
            'multiple_choice', 'true_false', 'exercise', 'assignment'
          ))
        )
        and (
          v_status = 'all'
          or (v_status = 'custom' and combined.custom)
          or (v_status = 'in_quiz' and not combined.custom)
        )
        and (
          v_search is null
          or combined.question_text ilike ('%' || v_search || '%')
          or combined.lesson_title ilike ('%' || v_search || '%')
          or combined.module_title ilike ('%' || v_search || '%')
          or combined.program_name ilike ('%' || v_search || '%')
        )
    ),
    question_rows as (
      select *
      from catalog_rows
      where (p_program_id is null or program_id = p_program_id)
        and (p_module_id is null or v_status = 'custom' or module_id = p_module_id)
    ),
    summary as (
      select
        count(*)::integer as total,
        count(*) filter (where type = 'multiple_choice')::integer as multiple_choice,
        count(*) filter (where type = 'true_false')::integer as true_false,
        count(*) filter (where type = 'exercise')::integer as exercise,
        count(*) filter (where type = 'assignment')::integer as assignment,
        count(*) filter (
          where type not in ('multiple_choice', 'true_false', 'exercise', 'assignment')
        )::integer as other,
        count(*) filter (where custom)::integer as custom,
        count(distinct program_id)::integer as program_count
      from question_rows
    ),
    paged as (
      select *
      from question_rows
      order by custom desc, program_name, module_sort, module_title, lesson_sort, lesson_title, sort_order
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
              'lessonType', p.lesson_type,
              'quizId', p.quiz_id,
              'sortOrder', p.sort_order,
              'custom', p.custom
            )
            order by p.custom desc, p.program_name, p.module_sort, p.module_title, p.lesson_sort, p.lesson_title, p.sort_order
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
          'exercise', s.exercise,
          'assignment', s.assignment,
          'other', s.other,
          'custom', s.custom,
          'programCount', s.program_count
        )
        from summary s
      ),
      'programs', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', ap.id,
              'name', ap.name,
              'questionCount', coalesce(qc.question_count, 0)
            )
            order by ap.name
          )
          from accessible_programs ap
          left join (
            select program_id, count(*)::integer as question_count
            from catalog_rows
            group by program_id
          ) qc on qc.program_id = ap.id
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

grant execute on function public.academy_list_question_bank(text, text, text, uuid, uuid, integer, integer, text)
  to authenticated, service_role;
