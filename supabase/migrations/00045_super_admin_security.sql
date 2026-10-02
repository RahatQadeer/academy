-- Super Admin high-security hardenings: stronger passwords + login attempt log.

create or replace function public.upsert_super_admin(p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'email is required';
  end if;
  if p_password is null or char_length(p_password) < 12 then
    raise exception 'password must be at least 12 characters';
  end if;

  insert into public.super_admins (email, password_hash)
  values (v_email, crypt(p_password, gen_salt('bf', 12)))
  on conflict (email) do update
    set password_hash = excluded.password_hash,
        updated_at = now();
end;
$$;

create table if not exists public.super_admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_key text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists super_admin_login_attempts_key_created_idx
  on public.super_admin_login_attempts (attempt_key, created_at desc);

alter table public.super_admin_login_attempts enable row level security;

revoke all on public.super_admin_login_attempts from public;
revoke all on public.super_admin_login_attempts from anon;
revoke all on public.super_admin_login_attempts from authenticated;
grant all on public.super_admin_login_attempts to service_role;

-- True when this key is locked out (too many failures in the window).
create or replace function public.super_admin_login_locked(
  p_key text,
  p_window_seconds integer default 900,
  p_max_failures integer default 5
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select count(*)::integer
      from public.super_admin_login_attempts
      where attempt_key = p_key
        and success = false
        and created_at > now() - make_interval(secs => p_window_seconds)
    ) >= p_max_failures,
    false
  );
$$;

revoke all on function public.super_admin_login_locked(text, integer, integer) from public;
revoke all on function public.super_admin_login_locked(text, integer, integer) from anon;
revoke all on function public.super_admin_login_locked(text, integer, integer) from authenticated;
grant execute on function public.super_admin_login_locked(text, integer, integer) to service_role;

create or replace function public.record_super_admin_login_attempt(
  p_key text,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.super_admin_login_attempts (attempt_key, success)
  values (p_key, p_success);

  -- Keep the table small.
  delete from public.super_admin_login_attempts
  where created_at < now() - interval '7 days';
end;
$$;

revoke all on function public.record_super_admin_login_attempt(text, boolean) from public;
revoke all on function public.record_super_admin_login_attempt(text, boolean) from anon;
revoke all on function public.record_super_admin_login_attempt(text, boolean) from authenticated;
grant execute on function public.record_super_admin_login_attempt(text, boolean) to service_role;
