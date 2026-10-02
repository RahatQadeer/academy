-- Academy Admin role provisioning (PA-ACA-020).
-- Academy-owned. Tightens academy_memberships so Admin rows cannot be
-- inserted, updated, or deleted through ordinary table policies.
-- Grant/revoke of role = admin is only via security-definer RPCs.
-- Learner self-provisioning (role = learner, user_id = auth.uid()) is unchanged.
-- Instructor grant (role = instructor) remains a table write for Academy Admins.
-- unique(user_id, role) is unchanged.

create or replace function public.academy_memberships_guard_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      raise exception 'academy_memberships role cannot change';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'academy_memberships user_id cannot change';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_memberships_guard_identity on public.academy_memberships;
create trigger academy_memberships_guard_identity
  before update on public.academy_memberships
  for each row execute function public.academy_memberships_guard_identity();

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
      public.has_academy_entitlement()
      and public.is_academy_admin()
      and role = 'instructor'
      and status = 'active'
    )
  );

create policy academy_memberships_update on public.academy_memberships
  for update using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
    and role = 'instructor'
  )
  with check (
    public.has_academy_entitlement()
    and public.is_academy_admin()
    and role = 'instructor'
  );

create policy academy_memberships_delete on public.academy_memberships
  for delete using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
    and role = 'instructor'
  );

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
     or not (public.has_academy_entitlement() and public.is_academy_admin()) then
    raise exception 'academy_admin_unauthorized';
  end if;

  if p_user_id is null or not exists (
    select 1 from public.users u where u.id = p_user_id
  ) then
    raise exception 'academy_admin_user_not_found';
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
     or not (public.has_academy_entitlement() and public.is_academy_admin()) then
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

revoke all on function public.academy_grant_admin(uuid) from public;
revoke all on function public.academy_revoke_admin(uuid) from public;
grant execute on function public.academy_grant_admin(uuid) to authenticated;
grant execute on function public.academy_revoke_admin(uuid) to authenticated;
