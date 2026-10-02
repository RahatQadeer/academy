-- Stripe refund/chargeback → earning reversal (SRS §17.7.8)

alter table public.partner_attribution_events
  add column if not exists amount_collected_cents integer;

alter table public.partner_earning_adjustments
  add column if not exists external_ref text,
  add column if not exists applied_at timestamptz;

create unique index if not exists partner_earning_adjustments_earning_external_ref
  on public.partner_earning_adjustments (earning_id, external_ref)
  where external_ref is not null;
