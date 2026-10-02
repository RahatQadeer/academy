-- Exactly one Academy Super Admin (product rule).
-- Multiple Admins / Instructors / Learners remain allowed.
-- No new tables. Granting a second active Super Admin is rejected.
-- Changing the sole Super Admin is done via SQL bootstrap (service role), not the app UI.

create or replace function public.academy_grant_super_admin(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status public.academy_membership_status;
  v_other_active integer;
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

  if p_user_id = auth.uid() then
    raise exception 'academy_super_admin_self_grant';
  end if;

  -- Block a second active Super Admin (Academy allows only one).
  select count(*)::integer into v_other_active
  from public.academy_memberships m
  where m.role = 'super_admin'
    and m.status = 'active'
    and m.user_id is distinct from p_user_id;

  if coalesce(v_other_active, 0) >= 1 then
    raise exception 'academy_single_super_admin_required';
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
    -- Reactivate only when no other active Super Admin exists (checked above).
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

      select count(*)::integer into v_other_active
      from public.academy_memberships m
      where m.role = 'super_admin'
        and m.status = 'active'
        and m.user_id is distinct from p_user_id;

      if coalesce(v_other_active, 0) >= 1 then
        raise exception 'academy_single_super_admin_required';
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

-- Revoke remains blocked while only one active Super Admin exists
-- (academy_last_super_admin_required). App no longer exposes Roles UI.

grant execute on function public.academy_grant_super_admin(uuid) to authenticated;

comment on function public.academy_grant_super_admin(uuid) is
  'Grants Academy Super Admin. At most one active Super Admin is allowed; bootstrap extras via service-role SQL only.';
