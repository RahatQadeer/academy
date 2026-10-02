-- Partner Admin staff role + dual message channels.
-- Idempotent: safe to run twice.

-- ---------------------------------------------------------------------------
-- partner_admins
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.partner_admin_status as enum ('invited', 'active', 'revoked');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.partner_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references public.users (id) on delete set null,
  status public.partner_admin_status not null default 'invited',
  invite_token_hash text,
  invite_expires_at timestamptz,
  invited_by_email text,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_admins_email_lower check (email = lower(btrim(email)))
);

create unique index if not exists partner_admins_email_uidx
  on public.partner_admins (email);

create index if not exists partner_admins_user_id_idx
  on public.partner_admins (user_id)
  where user_id is not null;

create index if not exists partner_admins_status_idx
  on public.partner_admins (status);

alter table public.partner_admins enable row level security;

revoke all on public.partner_admins from public;
revoke all on public.partner_admins from anon;
revoke all on public.partner_admins from authenticated;
grant all on public.partner_admins to service_role;

-- ---------------------------------------------------------------------------
-- Message channels
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.partner_message_channel as enum (
    'partner_manager',
    'support_billing'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.partner_messages
  add column if not exists channel public.partner_message_channel;

-- Backfill existing threads onto Support and Billing (Super Admin channel).
update public.partner_messages
set channel = 'support_billing'
where channel is null;

alter table public.partner_messages
  alter column channel set default 'partner_manager';

do $$ begin
  alter table public.partner_messages
    alter column channel set not null;
exception
  when others then null;
end $$;

create index if not exists partner_messages_profile_channel_created_idx
  on public.partner_messages (partner_profile_id, channel, created_at);

-- ---------------------------------------------------------------------------
-- Staff reads: one cursor per profile + channel
-- ---------------------------------------------------------------------------

create table if not exists public.partner_message_staff_reads_v2 (
  partner_profile_id uuid not null
    references public.partner_profiles (id) on delete cascade,
  channel public.partner_message_channel not null default 'support_billing',
  last_read_at timestamptz not null default now(),
  reader_user_id uuid references public.users (id) on delete set null,
  primary key (partner_profile_id, channel)
);

-- Enable RLS immediately so the table is never open to JWT clients.
alter table public.partner_message_staff_reads_v2 enable row level security;
revoke all on public.partner_message_staff_reads_v2 from public;
revoke all on public.partner_message_staff_reads_v2 from anon;
revoke all on public.partner_message_staff_reads_v2 from authenticated;
grant select on public.partner_message_staff_reads_v2 to authenticated;
grant all on public.partner_message_staff_reads_v2 to service_role;

-- Copy legacy single-cursor rows onto support_billing.
insert into public.partner_message_staff_reads_v2 (
  partner_profile_id,
  channel,
  last_read_at,
  reader_user_id
)
select
  partner_profile_id,
  'support_billing'::public.partner_message_channel,
  last_read_at,
  reader_user_id
from public.partner_message_staff_reads
on conflict (partner_profile_id, channel) do nothing;

drop function if exists public.partner_staff_mark_messages_read(uuid);

drop table if exists public.partner_message_staff_reads;

alter table public.partner_message_staff_reads_v2
  rename to partner_message_staff_reads;

alter table public.partner_message_staff_reads enable row level security;

grant select on public.partner_message_staff_reads to authenticated;
grant all on public.partner_message_staff_reads to service_role;

drop policy if exists partner_message_staff_reads_select
  on public.partner_message_staff_reads;
create policy partner_message_staff_reads_select
  on public.partner_message_staff_reads
  for select using (public.is_partner_member(partner_profile_id));

create or replace function public.partner_staff_mark_messages_read(
  p_profile_id uuid,
  p_channel public.partner_message_channel default 'support_billing'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.partner_message_staff_reads (
    partner_profile_id,
    channel,
    last_read_at,
    reader_user_id
  )
  values (p_profile_id, p_channel, now(), auth.uid())
  on conflict (partner_profile_id, channel)
  do update set
    last_read_at = excluded.last_read_at,
    reader_user_id = excluded.reader_user_id;
end;
$$;

revoke all on function public.partner_staff_mark_messages_read(uuid, public.partner_message_channel)
  from public;
grant execute on function public.partner_staff_mark_messages_read(uuid, public.partner_message_channel)
  to authenticated;
grant execute on function public.partner_staff_mark_messages_read(uuid, public.partner_message_channel)
  to service_role;

do $$ begin
  alter publication supabase_realtime add table public.partner_message_staff_reads;
exception
  when duplicate_object then null;
  when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- Admin notifications: channel audience
-- ---------------------------------------------------------------------------

alter table public.partner_admin_notifications
  add column if not exists channel public.partner_message_channel;

update public.partner_admin_notifications
set channel = 'support_billing'
where channel is null;

alter table public.partner_admin_notifications
  alter column channel set default 'support_billing';

do $$ begin
  alter table public.partner_admin_notifications
    alter column channel set not null;
exception
  when others then null;
end $$;

create index if not exists partner_admin_notifications_channel_created_idx
  on public.partner_admin_notifications (channel, created_at desc);

-- ---------------------------------------------------------------------------
-- Claim invite in one step (single-use, concurrent-safe)
-- ---------------------------------------------------------------------------

create or replace function public.claim_partner_admin_invite(
  p_email text,
  p_token_hash text,
  p_user_id uuid
)
returns public.partner_admins
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.partner_admins;
  normalized text := lower(btrim(p_email));
begin
  if p_user_id is null or p_token_hash is null or normalized = '' then
    raise exception 'Invalid claim';
  end if;

  update public.partner_admins
  set
    user_id = p_user_id,
    status = 'active',
    invite_token_hash = null,
    invite_expires_at = null,
    activated_at = now(),
    updated_at = now()
  where email = normalized
    and status = 'invited'
    and invite_token_hash = p_token_hash
    and invite_expires_at is not null
    and invite_expires_at > now()
  returning * into row;

  if row.id is null then
    raise exception 'Invite not claimable';
  end if;

  return row;
end;
$$;

revoke all on function public.claim_partner_admin_invite(text, text, uuid) from public;
revoke all on function public.claim_partner_admin_invite(text, text, uuid) from anon;
revoke all on function public.claim_partner_admin_invite(text, text, uuid) from authenticated;
grant execute on function public.claim_partner_admin_invite(text, text, uuid) to service_role;

-- Activate invited row on first admin sign-in (existing Auth account).
create or replace function public.activate_partner_admin_on_signin(
  p_email text,
  p_user_id uuid
)
returns public.partner_admins
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.partner_admins;
  normalized text := lower(btrim(p_email));
begin
  if p_user_id is null or normalized = '' then
    raise exception 'Invalid activation';
  end if;

  update public.partner_admins
  set
    user_id = p_user_id,
    status = 'active',
    invite_token_hash = null,
    invite_expires_at = null,
    activated_at = now(),
    updated_at = now()
  where email = normalized
    and status = 'invited'
    and invite_expires_at is not null
    and invite_expires_at > now()
  returning * into row;

  if row.id is null then
    raise exception 'Invite not activatable';
  end if;

  return row;
end;
$$;

revoke all on function public.activate_partner_admin_on_signin(text, uuid) from public;
revoke all on function public.activate_partner_admin_on_signin(text, uuid) from anon;
revoke all on function public.activate_partner_admin_on_signin(text, uuid) from authenticated;
grant execute on function public.activate_partner_admin_on_signin(text, uuid) to service_role;
