-- Academy Super Admin helpers / Admin RPCs (runs AFTER 00063 enum commit).
-- Distinct from platform /super-admin staff. No new tables.
-- Super Admin inherits Academy Admin RLS via is_academy_admin().
-- Admin grant/revoke RPCs require Super Admin (plain Admin cannot escalate peers).

create or replace function public.is_academy_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_academy_role('super_admin');
$$;

create or replace function public.is_academy_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Super Admin inherits every Academy Admin privilege at the RLS layer.
  select public.has_academy_role('admin')
      or public.has_academy_role('super_admin');
$$;

create or replace function public.academy_grant_admin(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status public.academy_membership_status;
begin
  if auth.uid() is null
     or not (public.has_academy_entitlement() and public.is_academy_super_admin()) then
    raise exception 'academy_admin_unauthorized';
  end if;

  if p_user_id is null or not exists (
    select 1 from public.users u where u.id = p_user_id
  ) then
    raise exception 'academy_admin_user_not_found';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'academy_admin_self_grant';
  end if;

  if exists (
    select 1
    from public.academy_memberships m
    where m.user_id = p_user_id
      and m.status = 'active'
      and m.role <> 'admin'
  ) then
    raise exception 'academy_role_conflict';
  end if;

  select m.id, m.status into v_id, v_status
  from public.academy_memberships m
  where m.user_id = p_user_id
    and m.role = 'admin';

  if v_id is not null then
    if v_status = 'active' then
      return 'already_admin';
    end if;
    update public.academy_memberships
      set status = 'active',
          granted_by_user_id = auth.uid(),
          granted_at = now()
      where id = v_id
        and role = 'admin';
    return 'reactivated';
  end if;

  begin
    insert into public.academy_memberships (
      user_id,
      role,
      status,
      granted_by_user_id
    )
    values (
      p_user_id,
      'admin',
      'active',
      auth.uid()
    );
    return 'granted';
  exception
    when unique_violation then
      select m.id, m.status into v_id, v_status
      from public.academy_memberships m
      where m.user_id = p_user_id
        and m.role = 'admin';
      if v_id is null then
        raise exception 'academy_admin_failed';
      end if;
      if v_status = 'active' then
        return 'already_admin';
      end if;
      update public.academy_memberships
        set status = 'active',
            granted_by_user_id = auth.uid(),
            granted_at = now()
        where id = v_id
          and role = 'admin';
      return 'reactivated';
  end;
end;
$$;

create or replace function public.academy_revoke_admin(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status public.academy_membership_status;
  v_active integer;
begin
  if auth.uid() is null
     or not (public.has_academy_entitlement() and public.is_academy_super_admin()) then
    raise exception 'academy_admin_unauthorized';
  end if;

  if p_user_id is null then
    raise exception 'academy_admin_not_found';
  end if;

  perform 1
  from public.academy_memberships
  where role = 'admin'
    and status = 'active'
  for update;

  select m.id, m.status into v_id, v_status
  from public.academy_memberships m
  where m.user_id = p_user_id
    and m.role = 'admin';

  if v_id is null then
    raise exception 'academy_admin_not_found';
  end if;

  if v_status = 'suspended' then
    return 'already_suspended';
  end if;

  select count(*)::integer into v_active
  from public.academy_memberships
  where role = 'admin'
    and status = 'active';

  if coalesce(v_active, 0) <= 1 then
    raise exception 'academy_last_admin_required';
  end if;

  update public.academy_memberships
    set status = 'suspended'
    where id = v_id
      and role = 'admin';

  return 'suspended';
end;
$$;

revoke all on function public.is_academy_super_admin() from public;
grant execute on function public.is_academy_super_admin() to anon, authenticated, service_role;
grant execute on function public.is_academy_admin() to anon, authenticated, service_role;
grant execute on function public.academy_grant_admin(uuid) to authenticated;
grant execute on function public.academy_revoke_admin(uuid) to authenticated;

comment on function public.is_academy_super_admin() is
  'True when the caller has an active academy_memberships.role = super_admin.';
comment on function public.is_academy_admin() is
  'True for active Academy Admin or Super Admin (Super Admin inherits Admin access).';
