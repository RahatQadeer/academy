-- Global uniqueness on collected payment id (§17.7.11).
-- One economic payment must never create two attribution events across partners.
-- Keep partner-scoped unique index as defense in depth.
--
-- Before applying in production, verify no duplicates:
--   select external_payment_id, count(*) from partner_attribution_events
--   where external_payment_id is not null
--   group by 1 having count(*) > 1;

create unique index if not exists partner_attribution_events_payment_global
  on public.partner_attribution_events (external_payment_id)
  where external_payment_id is not null;
