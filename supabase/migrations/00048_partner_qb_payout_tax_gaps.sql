-- Partner Center QuickBooks remaining SRS gaps (§17.12 / §17.14.15 / §17.15.7)
-- preferred payout method, platform tax/payout config, 1099 rollups

-- ---------------------------------------------------------------------------
-- Preferred payout method on partner_profiles
-- ---------------------------------------------------------------------------

alter table public.partner_profiles
  add column if not exists preferred_payout_method text
    check (
      preferred_payout_method is null
      or preferred_payout_method in (
        'stripe_connect',
        'quickbooks',
        'ach',
        'check'
      )
    );

comment on column public.partner_profiles.preferred_payout_method is
  'Partner-selected payout rail (§17.13.6). Independent of tax profile.';

-- ---------------------------------------------------------------------------
-- Platform tax / payout configuration (singleton)
-- ---------------------------------------------------------------------------

create table if not exists public.partner_platform_tax_config (
  id uuid primary key default gen_random_uuid(),
  legal_payer_entity text not null default 'Private Attache',
  available_payout_methods text[] not null default array[
    'stripe_connect',
    'quickbooks'
  ]::text[],
  tax_form_type text not null default 'w9'
    check (tax_form_type in ('w9', 'w8', 'other')),
  tax_collection_source text not null default 'stripe_tax'
    check (
      tax_collection_source in ('stripe_tax', 'quickbooks_w9', 'other')
    ),
  updated_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_platform_tax_config_singleton check (id is not null)
);

-- Enforce at most one row via unique constant
create unique index if not exists partner_platform_tax_config_one_row
  on public.partner_platform_tax_config ((true));

alter table public.partner_platform_tax_config enable row level security;

insert into public.partner_platform_tax_config (
  legal_payer_entity,
  available_payout_methods,
  tax_form_type,
  tax_collection_source
)
select
  'Private Attache',
  array['stripe_connect', 'quickbooks']::text[],
  'w9',
  'stripe_tax'
where not exists (select 1 from public.partner_platform_tax_config);

-- ---------------------------------------------------------------------------
-- Annual 1099 rollup (§17.12.9–10)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.partner_1099_status as enum (
    'not_started',
    'in_progress',
    'complete',
    'filed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.partner_1099_rollups (
  id uuid primary key default gen_random_uuid(),
  tax_year integer not null,
  legal_payer_entity text not null,
  partner_profile_id uuid not null
    references public.partner_profiles (id) on delete cascade,
  reportable_total numeric(12, 2) not null default 0,
  stripe_paid_total numeric(12, 2) not null default 0,
  quickbooks_paid_total numeric(12, 2) not null default 0,
  adjustments numeric(12, 2) not null default 0,
  status public.partner_1099_status not null default 'not_started',
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tax_year, legal_payer_entity, partner_profile_id)
);

create index if not exists partner_1099_rollups_year_idx
  on public.partner_1099_rollups (tax_year);

alter table public.partner_1099_rollups enable row level security;
