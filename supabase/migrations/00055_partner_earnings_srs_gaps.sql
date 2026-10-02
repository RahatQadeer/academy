-- Partner Center earnings SRS gaps (§17.7 / §17.14 / §17.15.6)
-- Platform attribution config, FirstPromoter mapping, governing-doc on earnings,
-- custom attribution windows on global rules.

-- ---------------------------------------------------------------------------
-- Relax attribution window check so Admin can set custom days (§17.14.4)
-- ---------------------------------------------------------------------------

alter table public.partner_commission_rules
  drop constraint if exists partner_attribution_window_check;

alter table public.partner_commission_rules
  add constraint partner_attribution_window_check
  check (attribution_window_days > 0);

-- ---------------------------------------------------------------------------
-- Platform attribution / economics config (singleton) (§17.14.5–8, §17.5.13–14)
-- ---------------------------------------------------------------------------

create table if not exists public.partner_platform_attribution_config (
  id uuid primary key default gen_random_uuid(),
  default_cookie_life_days integer not null default 90
    check (default_cookie_life_days > 0),
  attribution_mode text not null default 'first_touch'
    check (attribution_mode in ('first_touch', 'last_touch')),
  default_refund_rule text not null default 'proportional'
    check (
      default_refund_rule in (
        'full',
        'proportional',
        'future_negative_after_payout'
      )
    ),
  conversion_eligibility jsonb not null default '{
    "academy": {"paid_enrollment": true, "free_enrollment": false},
    "platform": {"first_paid_subscription": true, "trial": false, "account_creation": false}
  }'::jsonb,
  firstpromoter_enabled boolean not null default false,
  firstpromoter_account_id text,
  updated_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_platform_attribution_config_one_row
  on public.partner_platform_attribution_config ((true));

alter table public.partner_platform_attribution_config enable row level security;

insert into public.partner_platform_attribution_config (
  default_cookie_life_days,
  attribution_mode,
  default_refund_rule
)
select 90, 'first_touch', 'proportional'
where not exists (select 1 from public.partner_platform_attribution_config);

-- ---------------------------------------------------------------------------
-- FirstPromoter partner mapping (§17.14.14)
-- ---------------------------------------------------------------------------

create table if not exists public.partner_firstpromoter_mappings (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null
    references public.partner_profiles (id) on delete cascade,
  promoter_id text not null,
  campaign_id text,
  program public.partner_program_family,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promoter_id)
);

create index if not exists partner_firstpromoter_mappings_partner_idx
  on public.partner_firstpromoter_mappings (partner_profile_id);

alter table public.partner_firstpromoter_mappings enable row level security;

create table if not exists public.partner_fp_webhook_events (
  id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.partner_fp_webhook_events enable row level security;

-- Allow firstpromoter on integration credentials
alter table public.partner_integration_credentials
  drop constraint if exists partner_integration_credentials_provider_check;

alter table public.partner_integration_credentials
  add constraint partner_integration_credentials_provider_check
  check (provider in ('quickbooks', 'firstpromoter'));

-- ---------------------------------------------------------------------------
-- Governing agreement / program-terms link on earnings (§14.11 / §17.14.13)
-- ---------------------------------------------------------------------------

alter table public.partner_earnings
  add column if not exists governing_document_id uuid
    references public.documents (id) on delete set null;

alter table public.partner_earnings
  add column if not exists terms_version text;

comment on column public.partner_earnings.governing_document_id is
  'Agreement or program-terms document authorizing this commission (§14.11).';

comment on column public.partner_earnings.terms_version is
  'Program terms / agreement version string at earning creation (§17.14.13).';
