-- Enterprise opportunity attribution (SRS §17.6.11, §17.7.9, §17.7.11)

alter table public.partner_attribution_events
  alter column referred_user_id drop not null;

alter table public.partner_attribution_events
  add constraint partner_attribution_events_referral_or_opportunity check (
    referral_id is not null or opportunity_id is not null
  );

create unique index if not exists partner_attribution_events_partner_payment
  on public.partner_attribution_events (partner_profile_id, external_payment_id)
  where external_payment_id is not null;
