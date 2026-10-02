-- Academy rich content authoring for Admin catalog generation.
-- Adds lesson body storage, richer lesson types, lesson resources,
-- and assignment content so AI-generated drafts can persist full content.

alter type public.academy_lesson_type add value if not exists 'scenario';
alter type public.academy_lesson_type add value if not exists 'resource';
alter type public.academy_lesson_type add value if not exists 'assignment';

alter table public.academy_lessons
  add column if not exists content_body text,
  add column if not exists content_summary text,
  add column if not exists learning_objectives text[] not null default '{}',
  add column if not exists video_url text;

create table if not exists public.academy_lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.academy_lessons (id) on delete cascade,
  title text not null,
  resource_type text not null default 'link',
  url text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.academy_lessons (id) on delete cascade,
  brief text not null default '',
  submission_instructions text not null default '',
  rubric text not null default '',
  estimated_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop policy if exists academy_lesson_resources_select on public.academy_lesson_resources;
create policy academy_lesson_resources_select on public.academy_lesson_resources
  for select using (
    public.academy_can_read_program(public.academy_program_id_from_lesson(lesson_id))
  );

drop policy if exists academy_lesson_resources_write on public.academy_lesson_resources;
create policy academy_lesson_resources_write on public.academy_lesson_resources
  for all using (
    public.academy_can_author_program(public.academy_program_id_from_lesson(lesson_id))
  )
  with check (
    public.academy_can_author_program(public.academy_program_id_from_lesson(lesson_id))
  );

drop policy if exists academy_assignments_select on public.academy_assignments;
create policy academy_assignments_select on public.academy_assignments
  for select using (
    public.academy_can_read_program(public.academy_program_id_from_lesson(lesson_id))
  );

drop policy if exists academy_assignments_write on public.academy_assignments;
create policy academy_assignments_write on public.academy_assignments
  for all using (
    public.academy_can_author_program(public.academy_program_id_from_lesson(lesson_id))
  )
  with check (
    public.academy_can_author_program(public.academy_program_id_from_lesson(lesson_id))
  );

grant select, insert, update, delete on public.academy_lesson_resources to authenticated, service_role;
grant select, insert, update, delete on public.academy_assignments to authenticated, service_role;
