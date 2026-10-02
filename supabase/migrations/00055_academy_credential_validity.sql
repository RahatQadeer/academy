-- Credential validity on programs + renewal reminder ledger (Rahat / Academy).
-- Programs choose: none (does not expire) or three_years.
-- Learners get reminders at 90, 60, and 30 days before expires_at.

do $$ begin
  create type public.academy_credential_validity as enum (
    'none',
    'three_years'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.academy_programs
  add column if not exists credential_validity public.academy_credential_validity;

comment on column public.academy_programs.credential_validity is
  'Certificate term for awards from this program: none = no expiry; three_years = expires_at = award + 3 years.';

-- Backfill: CPA / professional certification defaults to a 3-year term.
update public.academy_programs
set credential_validity = case
  when recognition = 'professional_certification'::public.academy_course_recognition
    then 'three_years'::public.academy_credential_validity
  when type::text in ('certification_program', 'cpa')
    then 'three_years'::public.academy_credential_validity
  else 'none'::public.academy_credential_validity
end
where credential_validity is null;

alter table public.academy_programs
  alter column credential_validity set default 'none'::public.academy_credential_validity;

alter table public.academy_programs
  alter column credential_validity set not null;

create table if not exists public.academy_credential_renewal_reminders (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.academy_credentials (id) on delete cascade,
  days_before integer not null check (days_before in (90, 60, 30)),
  sent_at timestamptz not null default now(),
  channel text not null default 'email',
  status text not null default 'sent',
  unique (credential_id, days_before)
);

create index if not exists academy_credential_renewal_reminders_credential_idx
  on public.academy_credential_renewal_reminders (credential_id);

create index if not exists academy_credentials_expires_at_idx
  on public.academy_credentials (expires_at)
  where expires_at is not null and status = 'awarded';

alter table public.academy_credential_renewal_reminders enable row level security;

-- Service role / cron uses admin client; no learner policies needed for inserts.
drop policy if exists academy_credential_renewal_reminders_select on public.academy_credential_renewal_reminders;
create policy academy_credential_renewal_reminders_select
  on public.academy_credential_renewal_reminders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.academy_credentials c
      where c.id = academy_credential_renewal_reminders.credential_id
        and c.user_id = auth.uid()
    )
    or public.is_academy_admin()
  );
