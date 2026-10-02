-- Partner Center RLS policies — owner: Zara (prefix partner_)
--
-- Context: 00007 enabled RLS on every partner_* table but only created policies
-- for partner_profiles (as `auth.uid() is not null`) and partner_commission_rules
-- (read `true`). Two problems:
--   1. partner_profiles is readable/writable by ANY signed-in user — every
--      entitled user can see every partner. This drops and replaces that policy.
--   2. Every other partner_* table has RLS on with no policy, so authenticated
--      inserts are denied — this is why saving a partner application fails.
--
-- Scope: a partner is a `contacts` row linked to a partner_profile, either as the
-- primary contact or through partner_team_members. contacts has no user_id, so
-- the caller is resolved by matching users.email = contacts.email (same identity
-- rule as Client Portal). Access is scoped to the caller's own partner profile,
-- NOT to "any signed-in user" and NOT to has_entitlement('partner_center')
-- (which would expose every partner to every entitled user).
--
-- Not touched: base and whitbyos_* policies; partner_commission_rules
-- (keeps its existing global-default read policy). No new columns, no new tables.

-- Does the caller (auth.uid()) own the given contact, by email identity?
create or replace function public.is_partner_contact(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contacts c
    join public.users u on lower(u.email) = lower(c.email)
    where c.id = p_contact_id
      and u.id = auth.uid()
  );
$$;

-- Is the caller a member of the given partner profile — either its primary
-- contact or a partner_team_members entry — resolved by email identity?
create or replace function public.is_partner_member(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_profiles pp
    join public.contacts c on c.id = pp.primary_contact_id
    join public.users u on lower(u.email) = lower(c.email)
    where pp.id = p_profile_id
      and u.id = auth.uid()
  )
  or exists (
    select 1
    from public.partner_team_members ptm
    join public.contacts c on c.id = ptm.contact_id
    join public.users u on lower(u.email) = lower(c.email)
    where ptm.partner_profile_id = p_profile_id
      and u.id = auth.uid()
  );
$$;

-- partner_profiles: replace the "any signed-in user" policy.
drop policy if exists partner_profiles_auth on public.partner_profiles;

-- Read/update/delete are scoped to the caller's own profile. Insert cannot use
-- is_partner_member (the row does not exist yet), so it checks that the new
-- profile's primary contact belongs to the caller — this is how an applicant
-- creates their first profile during onboarding.
drop policy if exists partner_profiles_select on public.partner_profiles;
create policy partner_profiles_select on public.partner_profiles
  for select using (public.is_partner_member(id));

drop policy if exists partner_profiles_insert on public.partner_profiles;
create policy partner_profiles_insert on public.partner_profiles
  for insert with check (public.is_partner_contact(primary_contact_id));

drop policy if exists partner_profiles_update on public.partner_profiles;
create policy partner_profiles_update on public.partner_profiles
  for update using (public.is_partner_member(id))
  with check (public.is_partner_member(id));

-- partner_team_members: scoped to the owning profile. On the application insert
-- the profile already exists with the caller as primary contact, so
-- is_partner_member resolves true before any team-member row is written.
drop policy if exists partner_team_members_member on public.partner_team_members;
create policy partner_team_members_member on public.partner_team_members
  for all using (public.is_partner_member(partner_profile_id))
  with check (public.is_partner_member(partner_profile_id));

-- Remaining tables that carry partner_profile_id directly.
drop policy if exists partner_programs_member on public.partner_programs;
create policy partner_programs_member on public.partner_programs
  for all using (public.is_partner_member(partner_profile_id))
  with check (public.is_partner_member(partner_profile_id));

drop policy if exists partner_links_codes_member on public.partner_links_codes;
create policy partner_links_codes_member on public.partner_links_codes
  for all using (public.is_partner_member(partner_profile_id))
  with check (public.is_partner_member(partner_profile_id));

drop policy if exists partner_referrals_member on public.partner_referrals;
create policy partner_referrals_member on public.partner_referrals
  for all using (public.is_partner_member(partner_profile_id))
  with check (public.is_partner_member(partner_profile_id));

drop policy if exists partner_opportunities_member on public.partner_opportunities;
create policy partner_opportunities_member on public.partner_opportunities
  for all using (public.is_partner_member(partner_profile_id))
  with check (public.is_partner_member(partner_profile_id));

drop policy if exists partner_attribution_events_member on public.partner_attribution_events;
create policy partner_attribution_events_member on public.partner_attribution_events
  for all using (public.is_partner_member(partner_profile_id))
  with check (public.is_partner_member(partner_profile_id));

drop policy if exists partner_earnings_member on public.partner_earnings;
create policy partner_earnings_member on public.partner_earnings
  for all using (public.is_partner_member(partner_profile_id))
  with check (public.is_partner_member(partner_profile_id));

drop policy if exists partner_payouts_member on public.partner_payouts;
create policy partner_payouts_member on public.partner_payouts
  for all using (public.is_partner_member(partner_profile_id))
  with check (public.is_partner_member(partner_profile_id));

drop policy if exists partner_tax_profiles_member on public.partner_tax_profiles;
create policy partner_tax_profiles_member on public.partner_tax_profiles
  for all using (public.is_partner_member(partner_profile_id))
  with check (public.is_partner_member(partner_profile_id));

-- partner_earning_adjustments has no partner_profile_id; scope through its earning.
drop policy if exists partner_earning_adjustments_member on public.partner_earning_adjustments;
create policy partner_earning_adjustments_member on public.partner_earning_adjustments
  for all using (
    exists (
      select 1 from public.partner_earnings e
      where e.id = earning_id and public.is_partner_member(e.partner_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.partner_earnings e
      where e.id = earning_id and public.is_partner_member(e.partner_profile_id)
    )
  );
