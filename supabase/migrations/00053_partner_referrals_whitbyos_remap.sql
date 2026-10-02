-- Remap referral rows: former Whitby `platform` → `whitbyos`,
-- unsigned `shared` → `platform`. Drop the check BEFORE updates so
-- `whitbyos` rows are allowed; then re-add the constraint.
-- Enum value `shared` remains unused (Postgres cannot drop enum values easily).

alter table public.partner_referrals
  drop constraint if exists partner_referrals_not_enterprise;

update public.partner_referrals
set program = 'whitbyos'
where program = 'platform';

update public.partner_referrals
set program = 'platform'
where program = 'shared';

alter table public.partner_referrals
  add constraint partner_referrals_not_enterprise
  check (program in ('academy', 'platform', 'whitbyos'));
