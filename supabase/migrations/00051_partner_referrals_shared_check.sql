-- Allow shared on partner_referrals (enum value added in 00050).

alter table public.partner_referrals
  drop constraint if exists partner_referrals_not_enterprise;

alter table public.partner_referrals
  add constraint partner_referrals_not_enterprise
  check (program in ('academy', 'platform', 'shared'));
