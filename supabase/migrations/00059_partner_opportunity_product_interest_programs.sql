-- Enterprise Opportunity product interest: Academy / Whitby / Enterprise only
-- (multi-select stored as comma-separated values on partner_opportunities.product_interest).

insert into public.partner_opportunity_product_interests (
  value, label, sort_order, active, updated_at
)
select v.value, v.label, v.sort_order, true, now()
from (
  values
    ('academy', 'Academy', 10),
    ('whitbyos', 'Whitby', 20),
    ('enterprise', 'Enterprise', 30)
) as v(value, label, sort_order)
on conflict (value) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

update public.partner_opportunity_product_interests
set active = false, updated_at = now()
where value in ('academy_seats', 'platform_users', 'combined', 'other');
