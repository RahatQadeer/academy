-- Partner Center onboarding insert — owner: Zara (prefix partner_)
--
-- Continue on /partner-center/onboarding inserts contacts + companies, then
-- partner_profiles. 00011's insert policy (is_partner_contact only) rejects
-- that row even when the contact email matches public.users, which is why
-- every retry left an extra companies row and no profile.
--
-- No new tables or columns. Helpers trim emails and also accept the JWT
-- email. Insert is allowed for an entitled signed-in user whose primary
-- contact is their identity contact.

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
    where c.id = p_contact_id
      and c.email is not null
      and (
        exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and lower(trim(u.email)) = lower(trim(c.email))
        )
        or lower(trim(c.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      )
  );
$$;

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
    join public.users u on lower(trim(u.email)) = lower(trim(c.email))
    where pp.id = p_profile_id
      and u.id = auth.uid()
  )
  or exists (
    select 1
    from public.partner_team_members ptm
    join public.contacts c on c.id = ptm.contact_id
    join public.users u on lower(trim(u.email)) = lower(trim(c.email))
    where ptm.partner_profile_id = p_profile_id
      and u.id = auth.uid()
  )
  or (
    auth.uid() is not null
    and exists (
      select 1
      from public.partner_profiles pp
      join public.contacts c on c.id = pp.primary_contact_id
      where pp.id = p_profile_id
        and c.email is not null
        and lower(trim(c.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
  );
$$;

drop policy if exists partner_profiles_insert on public.partner_profiles;
create policy partner_profiles_insert on public.partner_profiles
  for insert
  with check (
    auth.uid() is not null
    and public.has_entitlement('partner_center')
    and (
      public.is_partner_contact(primary_contact_id)
      or exists (
        select 1
        from public.contacts c
        where c.id = primary_contact_id
          and c.email is not null
          and lower(trim(c.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      )
    )
  );
