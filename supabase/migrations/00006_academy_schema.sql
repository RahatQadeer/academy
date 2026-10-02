-- Academy + LMS schema — owner: Rahat (one schema for both surfaces)

create table public.academy_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.academy_program_type not null,
  category text,
  prerequisite_program_id uuid references public.academy_programs (id),
  price numeric,
  status public.academy_program_status not null default 'draft',
  description text,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_modules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.academy_programs (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0
);

create table public.academy_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_modules (id) on delete cascade,
  title text not null,
  type public.academy_lesson_type not null,
  content_url text,
  sort_order integer not null default 0
);

create table public.academy_quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.academy_lessons (id) on delete cascade,
  passing_score integer not null default 80
);

create table public.academy_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.academy_quizzes (id) on delete cascade,
  question_text text not null,
  type text not null,
  options jsonb,
  correct_answer text,
  sort_order integer not null default 0
);

create table public.academy_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  program_id uuid not null references public.academy_programs (id),
  status public.academy_enrollment_status not null default 'enrolled',
  progress_percent integer not null default 0,
  entitlement_source text,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, program_id)
);

create table public.academy_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_enrollments (id) on delete cascade,
  lesson_id uuid not null references public.academy_lessons (id),
  status public.academy_progress_status not null default 'locked',
  completed_at timestamptz,
  unique (enrollment_id, lesson_id)
);

create table public.academy_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  program_id uuid not null references public.academy_programs (id),
  type public.academy_credential_type not null,
  status public.academy_credential_status not null default 'required_learning',
  awarded_at timestamptz,
  expires_at timestamptz,
  renewal_status text
);

create table public.academy_instructor_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  program_id uuid not null references public.academy_programs (id) on delete cascade,
  permission_level text not null default 'edit',
  assigned_by_admin_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  constraint academy_instructor_no_publish check (permission_level in ('edit', 'create'))
);

create table public.academy_publish_requests (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.academy_programs (id) on delete cascade,
  submitted_by_user_id uuid not null references public.users (id),
  status public.academy_publish_status not null default 'pending',
  reviewed_by_admin_user_id uuid references public.users (id),
  reviewed_at timestamptz,
  notes text,
  published_by_user_id uuid references public.users (id),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.academy_training_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  workspace_id uuid not null references public.workspaces (id),
  program_id uuid not null references public.academy_programs (id),
  provisioned_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status public.academy_training_status not null default 'active',
  converted_to_paid_at timestamptz
);

alter table public.academy_programs enable row level security;
alter table public.academy_modules enable row level security;
alter table public.academy_lessons enable row level security;
alter table public.academy_quizzes enable row level security;
alter table public.academy_questions enable row level security;
alter table public.academy_enrollments enable row level security;
alter table public.academy_lesson_progress enable row level security;
alter table public.academy_credentials enable row level security;
alter table public.academy_instructor_assignments enable row level security;
alter table public.academy_publish_requests enable row level security;
alter table public.academy_training_workspaces enable row level security;

create policy academy_programs_select on public.academy_programs
  for select using (
    status = 'published' or created_by_user_id = auth.uid()
  );

create policy academy_programs_write on public.academy_programs
  for all using (created_by_user_id = auth.uid())
  with check (created_by_user_id = auth.uid());

create policy academy_catalog_read on public.academy_modules
  for select using (true);

create policy academy_lessons_read on public.academy_lessons
  for select using (true);

create policy academy_enrollments_own on public.academy_enrollments
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy academy_progress_own on public.academy_lesson_progress
  for all using (
    exists (
      select 1 from public.academy_enrollments e
      where e.id = enrollment_id and e.user_id = auth.uid()
    )
  );

create policy academy_credentials_own on public.academy_credentials
  for select using (user_id = auth.uid());

create policy academy_training_own on public.academy_training_workspaces
  for select using (user_id = auth.uid());
