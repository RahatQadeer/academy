-- Ticket 7: Super Admin role management + stop Admin privilege escalation via RLS.
-- No new tables — academy_memberships + RPCs only.

-- Plain Admin must not insert/update super_admin (or admin) rows directly.
-- Security-definer RPCs remain the path for Admin / Super Admin grants.

drop policy if exists academy_memberships_insert on public.academy_memberships;
drop policy if exists academy_memberships_update on public.academy_memberships;
drop policy if exists academy_memberships_delete on public.academy_memberships;

create policy academy_memberships_insert on public.academy_memberships
  for insert with check (
    (
      user_id = auth.uid()
      and role = 'learner'
      and status = 'active'
      and public.has_academy_entitlement()
    )
    or (
      public.is_academy_admin()
      and role in ('learner'::public.academy_role, 'instructor'::public.academy_role)
    )
    or (
      public.is_academy_super_admin()
      and role in (
        'learner'::public.academy_role,
        'instructor'::public.academy_role,
        'admin'::public.academy_role,
        'super_admin'::public.academy_role
      )
    )
  );

create policy academy_memberships_update on public.academy_memberships
  for update
  using (
    (
      public.is_academy_admin()
      and role in ('learner'::public.academy_role, 'instructor'::public.academy_role)
    )
    or public.is_academy_super_admin()
  )
  with check (
    (
      public.is_academy_admin()
      and role in ('learner'::public.academy_role, 'instructor'::public.academy_role)
    )
    or public.is_academy_super_admin()
  );

create policy academy_memberships_delete on public.academy_memberships
  for delete using (
    (
      public.is_academy_admin()
      and role in ('learner'::public.academy_role, 'instructor'::public.academy_role)
    )
    or public.is_academy_super_admin()
  );

create or replace function public.academy_grant_super_admin(p_user_id uuid)
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
    raise exception 'academy_super_admin_unauthorized';
  end if;

  if p_user_id is null or not exists (
    select 1 from public.users u where u.id = p_user_id
  ) then
    raise exception 'academy_super_admin_user_not_found';
  end if;

  -- Never allow self-promotion through this RPC (bootstrap is SQL / service role).
  if p_user_id = auth.uid() then
    raise exception 'academy_super_admin_self_grant';
  end if;

  if exists (
    select 1
    from public.academy_memberships m
    where m.user_id = p_user_id
      and m.status = 'active'
      and m.role <> 'super_admin'
  ) then
    raise exception 'academy_role_conflict';
  end if;

  select m.id, m.status into v_id, v_status
  from public.academy_memberships m
  where m.user_id = p_user_id
    and m.role = 'super_admin';

  if v_id is not null then
    if v_status = 'active' then
      return 'already_super_admin';
    end if;
    update public.academy_memberships
      set status = 'active',
          granted_by_user_id = auth.uid(),
          granted_at = now()
      where id = v_id
        and role = 'super_admin';
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
      'super_admin',
      'active',
      auth.uid()
    );
    return 'granted';
  exception
    when unique_violation then
      select m.id, m.status into v_id, v_status
      from public.academy_memberships m
      where m.user_id = p_user_id
        and m.role = 'super_admin';
      if v_id is null then
        raise exception 'academy_super_admin_failed';
      end if;
      if v_status = 'active' then
        return 'already_super_admin';
      end if;
      update public.academy_memberships
        set status = 'active',
            granted_by_user_id = auth.uid(),
            granted_at = now()
        where id = v_id
          and role = 'super_admin';
      return 'reactivated';
  end;
end;
$$;

create or replace function public.academy_revoke_super_admin(p_user_id uuid)
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
    raise exception 'academy_super_admin_unauthorized';
  end if;

  if p_user_id is null then
    raise exception 'academy_super_admin_not_found';
  end if;

  -- Cannot remove your own Super Admin role (avoids locking yourself out).
  if p_user_id = auth.uid() then
    raise exception 'academy_super_admin_self_revoke';
  end if;

  perform 1
  from public.academy_memberships
  where role = 'super_admin'
    and status = 'active'
  for update;

  select m.id, m.status into v_id, v_status
  from public.academy_memberships m
  where m.user_id = p_user_id
    and m.role = 'super_admin';

  if v_id is null then
    raise exception 'academy_super_admin_not_found';
  end if;

  if v_status = 'suspended' then
    return 'already_suspended';
  end if;

  select count(*)::integer into v_active
  from public.academy_memberships
  where role = 'super_admin'
    and status = 'active';

  if coalesce(v_active, 0) <= 1 then
    raise exception 'academy_last_super_admin_required';
  end if;

  update public.academy_memberships
    set status = 'suspended'
    where id = v_id
      and role = 'super_admin';

  return 'suspended';
end;
$$;

revoke all on function public.academy_grant_super_admin(uuid) from public;
revoke all on function public.academy_revoke_super_admin(uuid) from public;
grant execute on function public.academy_grant_super_admin(uuid) to authenticated;
grant execute on function public.academy_revoke_super_admin(uuid) to authenticated;
