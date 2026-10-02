-- Learner-initiated credential renewal requests, dynamic forms, and admin alerts.

create table if not exists public.academy_credential_renewal_requests (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.academy_credentials (id) on delete cascade,
  learner_user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending_admin'
    check (status in (
      'pending_admin',
      'awaiting_form',
      'awaiting_payment',
      'awaiting_form_and_payment',
      'under_review',
      'approved',
      'denied',
      'canceled'
    )),
  admin_path text
    check (
      admin_path is null
      or admin_path in (
        'approve_direct',
        'request_info',
        'require_payment',
        'require_payment_and_form'
      )
    ),
  admin_notes text,
  decided_by_user_id uuid references public.users (id) on delete set null,
  decided_at timestamptz,
  form_required boolean not null default false,
  form_status text not null default 'none'
    check (form_status in ('none', 'pending', 'submitted', 'reviewed')),
  form_submitted_at timestamptz,
  payment_required boolean not null default false,
  payment_amount numeric(12, 2),
  payment_currency text not null default 'usd',
  payment_status text not null default 'none'
    check (payment_status in ('none', 'pending', 'paid', 'failed', 'canceled')),
  stripe_checkout_session_id text,
  paid_at timestamptz,
  expires_at_snapshot timestamptz,
  expires_at_after timestamptz,
  learner_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_credential_renewal_requests_credential_idx
  on public.academy_credential_renewal_requests (credential_id, created_at desc);

create index if not exists academy_credential_renewal_requests_status_idx
  on public.academy_credential_renewal_requests (status, created_at desc);

create index if not exists academy_credential_renewal_requests_learner_idx
  on public.academy_credential_renewal_requests (learner_user_id, created_at desc);

-- At most one open request per credential.
create unique index if not exists academy_credential_renewal_requests_open_uidx
  on public.academy_credential_renewal_requests (credential_id)
  where status in (
    'pending_admin',
    'awaiting_form',
    'awaiting_payment',
    'awaiting_form_and_payment',
    'under_review'
  );

create table if not exists public.academy_credential_renewal_form_questions (
  id uuid primary key default gen_random_uuid(),
  renewal_request_id uuid not null
    references public.academy_credential_renewal_requests (id) on delete cascade,
  sort_order int not null default 0,
  prompt text not null,
  response_type text not null
    check (response_type in ('short_answer', 'long_answer', 'attachment')),
  required boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists academy_credential_renewal_form_questions_request_idx
  on public.academy_credential_renewal_form_questions (renewal_request_id, sort_order);

create table if not exists public.academy_credential_renewal_form_answers (
  id uuid primary key default gen_random_uuid(),
  renewal_request_id uuid not null
    references public.academy_credential_renewal_requests (id) on delete cascade,
  question_id uuid not null
    references public.academy_credential_renewal_form_questions (id) on delete cascade,
  answer_text text,
  attachment_path text,
  attachment_name text,
  submitted_at timestamptz not null default now(),
  unique (renewal_request_id, question_id)
);

create index if not exists academy_credential_renewal_form_answers_request_idx
  on public.academy_credential_renewal_form_answers (renewal_request_id);

create table if not exists public.academy_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  body text not null,
  href text,
  credential_id uuid references public.academy_credentials (id) on delete cascade,
  renewal_request_id uuid
    references public.academy_credential_renewal_requests (id) on delete cascade,
  created_at timestamptz not null default now(),
  dismissed_at timestamptz
);

create index if not exists academy_admin_notifications_open_idx
  on public.academy_admin_notifications (created_at desc)
  where dismissed_at is null;

alter table public.academy_credential_renewal_requests enable row level security;
alter table public.academy_credential_renewal_form_questions enable row level security;
alter table public.academy_credential_renewal_form_answers enable row level security;
alter table public.academy_admin_notifications enable row level security;

-- Helpers mirrored from existing academy RLS patterns.
create or replace function public.academy_is_credential_owner(p_credential_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_credentials c
    where c.id = p_credential_id
      and c.user_id = auth.uid()
  );
$$;

drop policy if exists academy_renewal_requests_select on public.academy_credential_renewal_requests;
create policy academy_renewal_requests_select
  on public.academy_credential_renewal_requests
  for select
  to authenticated
  using (
    learner_user_id = auth.uid()
    or public.is_academy_admin()
  );

drop policy if exists academy_renewal_requests_insert on public.academy_credential_renewal_requests;
create policy academy_renewal_requests_insert
  on public.academy_credential_renewal_requests
  for insert
  to authenticated
  with check (
    learner_user_id = auth.uid()
    and public.academy_is_credential_owner(credential_id)
  );

drop policy if exists academy_renewal_requests_update on public.academy_credential_renewal_requests;
create policy academy_renewal_requests_update
  on public.academy_credential_renewal_requests
  for update
  to authenticated
  using (
    learner_user_id = auth.uid()
    or public.is_academy_admin()
  )
  with check (
    learner_user_id = auth.uid()
    or public.is_academy_admin()
  );

drop policy if exists academy_renewal_questions_select on public.academy_credential_renewal_form_questions;
create policy academy_renewal_questions_select
  on public.academy_credential_renewal_form_questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.academy_credential_renewal_requests r
      where r.id = renewal_request_id
        and (r.learner_user_id = auth.uid() or public.is_academy_admin())
    )
  );

drop policy if exists academy_renewal_questions_write on public.academy_credential_renewal_form_questions;
create policy academy_renewal_questions_write
  on public.academy_credential_renewal_form_questions
  for all
  to authenticated
  using (public.is_academy_admin())
  with check (public.is_academy_admin());

drop policy if exists academy_renewal_answers_select on public.academy_credential_renewal_form_answers;
create policy academy_renewal_answers_select
  on public.academy_credential_renewal_form_answers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.academy_credential_renewal_requests r
      where r.id = renewal_request_id
        and (r.learner_user_id = auth.uid() or public.is_academy_admin())
    )
  );

drop policy if exists academy_renewal_answers_write on public.academy_credential_renewal_form_answers;
create policy academy_renewal_answers_write
  on public.academy_credential_renewal_form_answers
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.academy_credential_renewal_requests r
      where r.id = renewal_request_id
        and r.learner_user_id = auth.uid()
    )
    or public.is_academy_admin()
  )
  with check (
    exists (
      select 1
      from public.academy_credential_renewal_requests r
      where r.id = renewal_request_id
        and r.learner_user_id = auth.uid()
    )
    or public.is_academy_admin()
  );

drop policy if exists academy_admin_notifications_select on public.academy_admin_notifications;
create policy academy_admin_notifications_select
  on public.academy_admin_notifications
  for select
  to authenticated
  using (public.is_academy_admin());

drop policy if exists academy_admin_notifications_write on public.academy_admin_notifications;
create policy academy_admin_notifications_write
  on public.academy_admin_notifications
  for all
  to authenticated
  using (public.is_academy_admin())
  with check (public.is_academy_admin());
