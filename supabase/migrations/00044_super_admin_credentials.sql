-- Super Admin credentials live in the DB (email + password hash).
-- Add/update staff with:
--   select public.upsert_super_admin('you@example.com', 'your-password');
-- No Auth user. No product login.

-- Tear down any prior Auth-user allowlist shape if present.
drop policy if exists partner_admin_notifications_select on public.partner_admin_notifications;
drop function if exists public.partner_staff_mark_messages_read(uuid);
drop function if exists public.is_super_admin();
drop table if exists public.super_admins;

create table public.super_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint super_admins_email_unique unique (email)
);

create unique index super_admins_email_lower_idx
  on public.super_admins (lower(btrim(email)));

alter table public.super_admins enable row level security;

-- No authenticated access — only service role (app login + SQL upsert).
revoke all on public.super_admins from public;
revoke all on public.super_admins from anon;
revoke all on public.super_admins from authenticated;
grant all on public.super_admins to service_role;

-- Insert or update email + password (bcrypt via pgcrypto).
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
  if p_password is null or char_length(p_password) < 8 then
    raise exception 'password must be at least 8 characters';
  end if;

  insert into public.super_admins (email, password_hash)
  values (v_email, crypt(p_password, gen_salt('bf')))
  on conflict (email) do update
    set password_hash = excluded.password_hash,
        updated_at = now();
end;
$$;

revoke all on function public.upsert_super_admin(text, text) from public;
revoke all on function public.upsert_super_admin(text, text) from anon;
revoke all on function public.upsert_super_admin(text, text) from authenticated;
grant execute on function public.upsert_super_admin(text, text) to service_role;
-- Allow running from SQL Editor (postgres / dashboard roles typically have this via owner).
grant execute on function public.upsert_super_admin(text, text) to postgres;

-- Verify credentials for staff sign-in (service role only).
create or replace function public.verify_super_admin(p_email text, p_password text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.super_admins
    where email = lower(btrim(p_email))
      and password_hash = crypt(p_password, password_hash)
  );
$$;

revoke all on function public.verify_super_admin(text, text) from public;
revoke all on function public.verify_super_admin(text, text) from anon;
revoke all on function public.verify_super_admin(text, text) from authenticated;
grant execute on function public.verify_super_admin(text, text) to service_role;

-- Staff notifications: browser JWT users cannot read; app uses service role.
create policy partner_admin_notifications_select on public.partner_admin_notifications
  for select using (false);

-- Staff read cursor RPC: service role only (app writers).
create or replace function public.partner_staff_mark_messages_read(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.partner_message_staff_reads (
    partner_profile_id,
    last_read_at,
    reader_user_id
  )
  values (p_profile_id, now(), auth.uid())
  on conflict (partner_profile_id)
  do update set
    last_read_at = excluded.last_read_at,
    reader_user_id = excluded.reader_user_id;
end;
$$;

revoke all on function public.partner_staff_mark_messages_read(uuid) from public;
revoke all on function public.partner_staff_mark_messages_read(uuid) from authenticated;
grant execute on function public.partner_staff_mark_messages_read(uuid) to service_role;
