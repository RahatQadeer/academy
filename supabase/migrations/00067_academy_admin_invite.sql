-- Academy Admin invitations reuse base invitations with context academy_admin.
-- Super Admin invites someone who does not have an account yet; accept grants
-- academy entitlement + admin membership (exclusive role — other roles suspended).

alter type public.invitation_context_type add value if not exists 'academy_admin';

create or replace function public.academy_accept_admin_invitation(
  p_token text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations%rowtype;
begin
  if p_user_id is null or p_token is null or char_length(trim(p_token)) = 0 then
    raise exception 'Invalid admin invitation';
  end if;

  select *
  into inv
  from public.invitations
  where token = trim(p_token)
    and context_type = 'academy_admin'
    and status = 'pending'
  limit 1;

  if not found then
    raise exception 'Admin invitation not found';
  end if;

  if inv.expires_at is not null and inv.expires_at < now() then
    update public.invitations
    set status = 'expired'
    where id = inv.id;
    raise exception 'Admin invitation has expired';
  end if;

  if lower(trim(inv.invitee_email)) <> (
    select lower(trim(u.email))
    from public.users u
    where u.id = p_user_id
  ) then
    raise exception 'Invitation email does not match this account';
  end if;

  insert into public.entitlements (user_id, product, workspace_id, status, is_default_landing)
  select p_user_id, 'academy'::public.product_key, null, 'active'::public.entitlement_status, true
  where not exists (
    select 1
    from public.entitlements e
    where e.user_id = p_user_id
      and e.product = 'academy'
      and e.workspace_id is null
  );

  -- One email, one Academy role: clear anything else before activating Admin.
  update public.academy_memberships
  set status = 'suspended',
      updated_at = now()
  where user_id = p_user_id
    and status = 'active'
    and role <> 'admin';

  insert into public.academy_memberships (user_id, role, status, granted_by_user_id, granted_at)
  values (p_user_id, 'admin', 'active', inv.inviter_user_id, now())
  on conflict (user_id, role) do update
  set
    status = 'active',
    granted_by_user_id = excluded.granted_by_user_id,
    granted_at = excluded.granted_at,
    updated_at = now();

  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = inv.id;
end;
$$;

revoke all on function public.academy_accept_admin_invitation(text, uuid) from public;
grant execute on function public.academy_accept_admin_invitation(text, uuid) to authenticated, service_role;

comment on function public.academy_accept_admin_invitation(text, uuid) is
  'Accepts academy_admin invitation: entitlement + exclusive Admin membership.';
