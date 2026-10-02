-- Backfill SRS commission defaults on partner_commission_rules
-- (§25.6 rate already seeded; §17.7.3–6 basis / eligible period / payment terms).

update public.partner_commission_rules
set
  earning_basis = coalesce(nullif(trim(earning_basis), ''), 'first_collected_payment'),
  eligible_period = coalesce(nullif(trim(eligible_period), ''), 'one_payment'),
  payment_terms = coalesce(nullif(trim(payment_terms), ''), 'Net 30')
where
  earning_basis is null
  or trim(earning_basis) = ''
  or eligible_period is null
  or trim(eligible_period) = ''
  or payment_terms is null
  or trim(payment_terms) = '';
