-- Persist Academy learner onboarding completion + interests per user
-- so local and deployed share the same completion state (same Supabase).

create table if not exists public.academy_learner_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  onboarding_completed_at timestamptz,
  interest_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists academy_learner_profiles_set_updated_at on public.academy_learner_profiles;
create trigger academy_learner_profiles_set_updated_at
  before update on public.academy_learner_profiles
  for each row execute function public.set_updated_at();

alter table public.academy_learner_profiles enable row level security;

drop policy if exists academy_learner_profiles_select on public.academy_learner_profiles;
create policy academy_learner_profiles_select on public.academy_learner_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_academy_admin()
  );

drop policy if exists academy_learner_profiles_insert on public.academy_learner_profiles;
create policy academy_learner_profiles_insert on public.academy_learner_profiles
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_academy_entitlement()
  );

drop policy if exists academy_learner_profiles_update on public.academy_learner_profiles;
create policy academy_learner_profiles_update on public.academy_learner_profiles
  for update to authenticated
  using (
    user_id = auth.uid()
    and public.has_academy_entitlement()
  )
  with check (
    user_id = auth.uid()
    and public.has_academy_entitlement()
  );

grant select, insert, update on public.academy_learner_profiles to authenticated;
grant all on public.academy_learner_profiles to service_role;
