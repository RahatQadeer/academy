-- Instructor assignment coverage: null/empty = full program; otherwise selected modules.

alter table public.academy_instructor_assignments
  add column if not exists module_ids uuid[] not null default '{}'::uuid[];

comment on column public.academy_instructor_assignments.module_ids is
  'Empty array means full-program access. Non-empty lists the academy_modules the instructor may author.';
