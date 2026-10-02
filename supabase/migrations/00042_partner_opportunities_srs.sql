-- Partner Center Opportunities SRS completion (§17.6 / §17.14.10 / §17.15.4–5)
-- Proposed for Laiba review: partner in-app notifications, enterprise protection
-- rules, platform Intuit credentials + QB webhook idempotency.

-- ---------------------------------------------------------------------------
-- Partner in-app notifications (mirror partner_admin_notifications, scoped)
-- ---------------------------------------------------------------------------

create table if not exists public.partner_notifications (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null
    references public.partner_profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists partner_notifications_profile_created_idx
  on public.partner_notifications (partner_profile_id, created_at desc);

create table if not exists public.partner_notification_reads (
  notification_id uuid not null
    references public.partner_notifications (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.partner_notifications enable row level security;
alter table public.partner_notification_reads enable row level security;

drop policy if exists partner_notifications_select on public.partner_notifications;
create policy partner_notifications_select on public.partner_notifications
  for select using (public.is_partner_member(partner_profile_id));

drop policy if exists partner_notification_reads_select on public.partner_notification_reads;
create policy partner_notification_reads_select on public.partner_notification_reads
  for select using (user_id = auth.uid());

drop policy if exists partner_notification_reads_insert on public.partner_notification_reads;
create policy partner_notification_reads_insert on public.partner_notification_reads
  for insert with check (user_id = auth.uid());

drop policy if exists partner_notification_reads_update on public.partner_notification_reads;
create policy partner_notification_reads_update on public.partner_notification_reads
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts use service role only (admin status updates).

do $$
begin
  alter publication supabase_realtime add table public.partner_notifications;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Enterprise protection rules (§17.14.10)
-- ---------------------------------------------------------------------------

create table if not exists public.partner_enterprise_protection_rules (
  id uuid primary key default gen_random_uuid(),
  acceptance_required boolean not null default true,
  protection_period_days integer not null default 180
    check (protection_period_days > 0 and protection_period_days <= 3650),
  renewal_extension_notes text,
  conflict_resolution_notes text,
  updated_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Singleton: at most one active global config row (app always uses the latest).
insert into public.partner_enterprise_protection_rules (
  acceptance_required,
  protection_period_days,
  renewal_extension_notes,
  conflict_resolution_notes
)
select
  true,
  180,
  'Extensions require an audited admin override on the opportunity detail.',
  'Admin resolves attribution conflicts with a recorded reason; never silent overwrite.'
where not exists (
  select 1 from public.partner_enterprise_protection_rules
);

alter table public.partner_enterprise_protection_rules enable row level security;

-- Staff/service role manage via service client; authenticated partners may read
-- the active period for display (optional).
drop policy if exists partner_enterprise_protection_rules_select
  on public.partner_enterprise_protection_rules;
create policy partner_enterprise_protection_rules_select
  on public.partner_enterprise_protection_rules
  for select using (auth.uid() is not null);

-- Relax global enterprise attribution window CHECK so Program Config can sync
-- partner_commission_rules.attribution_window_days with protection_period_days.
alter table public.partner_commission_rules
  drop constraint if exists partner_attribution_window_check;

alter table public.partner_commission_rules
  add constraint partner_attribution_window_check check (
    (
      program = 'enterprise'
      and attribution_window_days >= 1
      and attribution_window_days <= 3650
    )
    or (
      program <> 'enterprise'
      and (
        attribution_window_days = 90
        or partner_profile_id is not null
      )
    )
    or partner_profile_id is not null
  );

-- ---------------------------------------------------------------------------
-- Platform Intuit / QuickBooks credentials + webhook idempotency (§17.15.4–5)
-- ---------------------------------------------------------------------------

create table if not exists public.partner_integration_credentials (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('quickbooks')),
  status text not null default 'disconnected'
    check (status in ('connected', 'needs_attention', 'disconnected')),
  realm_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text,
  connected_account text,
  last_sync_at timestamptz,
  error_state text,
  updated_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider)
);

create table if not exists public.partner_qb_webhook_events (
  id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.partner_integration_credentials enable row level security;
alter table public.partner_qb_webhook_events enable row level security;

-- Service-role only (no anon/authenticated policies) — platform secrets.
