-- Configurable Opportunity product-interest values (SRS §17.6.6).
-- Partner Center owned table — options are Admin-configured, not hard-coded.

create table if not exists public.partner_opportunity_product_interests (
  id uuid primary key default gen_random_uuid(),
  value text not null,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_opportunity_product_interests_value_format
    check (value ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint partner_opportunity_product_interests_value_unique unique (value)
);

create index if not exists partner_opportunity_product_interests_active_sort_idx
  on public.partner_opportunity_product_interests (active, sort_order, label);

insert into public.partner_opportunity_product_interests (
  value, label, sort_order, active
)
select v.value, v.label, v.sort_order, true
from (
  values
    ('academy_seats', 'Academy Seats', 10),
    ('platform_users', 'Platform Users', 20),
    ('combined', 'Combined', 30),
    ('other', 'Other / Custom', 40)
) as v(value, label, sort_order)
where not exists (
  select 1
  from public.partner_opportunity_product_interests existing
  where existing.value = v.value
);

alter table public.partner_opportunity_product_interests enable row level security;

-- Authenticated partners (and staff using user JWT) may read options for
-- forms and historical labels. Writes are service-role only (Super Admin).
drop policy if exists partner_opportunity_product_interests_select
  on public.partner_opportunity_product_interests;
create policy partner_opportunity_product_interests_select
  on public.partner_opportunity_product_interests
  for select using (auth.uid() is not null);
