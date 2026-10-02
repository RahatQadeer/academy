-- Partner Center schema — owner: Zara (prefix partner_)

create table public.partner_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  primary_contact_id uuid not null references public.contacts (id),
  status public.partner_profile_status not null default 'applied',
  partner_type text,
  application_data jsonb,
  agreement_status text,
  agreement_document_id uuid references public.documents (id),
  tax_profile_status public.partner_tax_status not null default 'not_started',
  payment_setup_status text,
  payout_eligibility public.partner_payout_eligibility not null default 'needs_tax_setup',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partner_team_members (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  contact_id uuid not null references public.contacts (id),
  function text not null,
  access_level text,
  created_at timestamptz not null default now()
);

create table public.partner_programs (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  program public.partner_program_family not null,
  active boolean not null default true,
  effective_start date,
  effective_end date
);

create table public.partner_commission_rules (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid references public.partner_profiles (id) on delete cascade,
  program public.partner_program_family not null,
  rate_type public.partner_rate_type not null default 'percentage',
  rate_value numeric not null default 15,
  earning_basis text,
  eligible_period text,
  attribution_window_days integer not null,
  eligible_revenue_rules jsonb,
  payment_terms text,
  effective_start date,
  effective_end date,
  created_at timestamptz not null default now(),
  constraint partner_attribution_window_check check (
    (program = 'enterprise' and attribution_window_days = 180)
    or (program <> 'enterprise' and attribution_window_days = 90)
    or partner_profile_id is not null
  )
);

create table public.partner_links_codes (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  code text not null unique,
  type public.partner_link_type not null,
  cookie_life_days integer,
  created_at timestamptz not null default now()
);

create table public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id),
  referral_code_id uuid references public.partner_links_codes (id),
  referred_user_id uuid references public.users (id),
  referred_contact_id uuid references public.contacts (id),
  program public.partner_program_family not null,
  product text,
  source text,
  referral_date date not null default current_date,
  status public.partner_referral_status not null default 'referred',
  conversion_event_date date,
  created_at timestamptz not null default now(),
  constraint partner_referrals_not_enterprise check (program in ('academy', 'platform'))
);

create table public.partner_opportunities (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id),
  company_id uuid not null references public.companies (id),
  primary_contact_id uuid not null references public.contacts (id),
  product_interest text,
  estimated_seats integer,
  estimated_value numeric,
  status public.partner_opportunity_status not null default 'submitted',
  accepted_at timestamptz,
  protected_until timestamptz,
  notes text,
  permission_to_contact boolean not null default false,
  attachment_document_id uuid references public.documents (id),
  created_at timestamptz not null default now()
);

create table public.partner_attribution_events (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id),
  referral_id uuid references public.partner_referrals (id),
  opportunity_id uuid references public.partner_opportunities (id),
  referred_user_id uuid not null references public.users (id),
  product text,
  qualifying_action text not null,
  event_source text,
  external_payment_id text,
  event_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.partner_earnings (
  id uuid primary key default gen_random_uuid(),
  attribution_event_id uuid not null references public.partner_attribution_events (id),
  partner_profile_id uuid not null references public.partner_profiles (id),
  commission_rule_id uuid not null references public.partner_commission_rules (id),
  amount numeric not null,
  status public.partner_earning_status not null default 'pending',
  collected_payment_source text,
  collected_payment_ref text,
  payable_date date,
  paid_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partner_earning_adjustments (
  id uuid primary key default gen_random_uuid(),
  earning_id uuid not null references public.partner_earnings (id) on delete cascade,
  type text not null,
  amount_delta numeric not null,
  reason text,
  created_by_admin_user_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

create table public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id),
  amount numeric not null,
  method public.partner_payout_method not null,
  status public.partner_payout_status not null default 'scheduled',
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.partner_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  legal_payee_name text,
  business_dba_name text,
  entity_classification text,
  mailing_address text,
  country text,
  tin_last4 text,
  form_type text,
  status public.partner_tax_status not null default 'not_started',
  collection_source text,
  external_record_id text,
  certified_at timestamptz,
  last_reviewed_at timestamptz
);

insert into public.partner_commission_rules (
  partner_profile_id,
  program,
  rate_type,
  rate_value,
  earning_basis,
  eligible_period,
  attribution_window_days,
  payment_terms
) values
  (null, 'academy', 'percentage', 15, 'first_collected_payment', 'one_payment', 90, 'Net 30'),
  (null, 'platform', 'percentage', 15, 'first_collected_payment', 'one_payment', 90, 'Net 30'),
  (null, 'enterprise', 'percentage', 15, 'first_collected_payment', 'one_payment', 180, 'Net 30');

alter table public.partner_profiles enable row level security;
alter table public.partner_team_members enable row level security;
alter table public.partner_programs enable row level security;
alter table public.partner_commission_rules enable row level security;
alter table public.partner_links_codes enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_opportunities enable row level security;
alter table public.partner_attribution_events enable row level security;
alter table public.partner_earnings enable row level security;
alter table public.partner_earning_adjustments enable row level security;
alter table public.partner_payouts enable row level security;
alter table public.partner_tax_profiles enable row level security;

create policy partner_commission_rules_read on public.partner_commission_rules
  for select using (true);

create policy partner_profiles_auth on public.partner_profiles
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);
