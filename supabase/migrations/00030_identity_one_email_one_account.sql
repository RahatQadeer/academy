-- One email → one active identity.
-- Does not merge or delete existing users. Case-variant duplicates are reported,
-- not auto-resolved. Academy Learner / Instructor / Admin remain memberships on
-- the same users.id (no second account is created for a second role).

create or replace function public.normalize_email(p_email text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(btrim(coalesce(p_email, '')));
$$;

create table if not exists public.identity_email_duplicate_report (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null,
  user_ids uuid[] not null,
  emails text[] not null,
  detected_at timestamptz not null default now()
);

insert into public.identity_email_duplicate_report (normalized_email, user_ids, emails)
select
  public.normalize_email(u.email),
  array_agg(u.id order by u.created_at, u.id),
  array_agg(u.email order by u.created_at, u.id)
from public.users u
group by public.normalize_email(u.email)
having count(*) > 1;

-- Safe to lowercase when it will not collide with another row.
update public.users u
set email = public.normalize_email(u.email)
where u.email is distinct from public.normalize_email(u.email)
  and not exists (
    select 1
    from public.users other
    where other.id <> u.id
      and public.normalize_email(other.email) = public.normalize_email(u.email)
  );

create or replace function public.users_normalize_email()
returns trigger
language plpgsql
as $$
begin
  new.email := public.normalize_email(new.email);
  return new;
end;
$$;

drop trigger if exists users_normalize_email on public.users;
create trigger users_normalize_email
  before insert or update of email on public.users
  for each row execute function public.users_normalize_email();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    oauth_provider,
    oauth_id,
    full_name,
    avatar_url,
    timezone
  )
  values (
    new.id,
    public.normalize_email(coalesce(new.email, '')),
    new.raw_app_meta_data->>'provider',
    new.raw_user_meta_data->>'provider_id',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'account'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'timezone', 'UTC')
  );
  return new;
end;
$$;

-- Expression unique index is the race-condition backstop. Skip it when
-- case-variant duplicates already exist so this migration never blocks deploy.
do $$
begin
  if exists (select 1 from public.identity_email_duplicate_report) then
    raise notice 'identity_email_duplicate_report has rows — skipping users_email_normalized_uidx until duplicates are resolved by hand';
    return;
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'users_email_normalized_uidx'
  ) then
    execute 'create unique index users_email_normalized_uidx on public.users (lower(btrim(email)))';
  end if;
end;
$$;

create or replace function public.find_active_accounts_by_normalized_email(p_email text)
returns table (
  id uuid,
  email text,
  status public.user_status
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select u.id, u.email, u.status
  from public.users u
  where public.normalize_email(u.email) = public.normalize_email(p_email)
    and u.status is distinct from 'deleted'
  order by u.created_at asc, u.id asc
  limit 8;
end;
$$;

revoke all on function public.normalize_email(text) from public;
revoke all on function public.find_active_accounts_by_normalized_email(text) from public;
grant execute on function public.normalize_email(text) to authenticated, service_role;
grant execute on function public.find_active_accounts_by_normalized_email(text) to service_role;

alter table public.identity_email_duplicate_report enable row level security;
