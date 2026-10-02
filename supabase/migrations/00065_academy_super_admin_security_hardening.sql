-- Ticket 11: Security hardening for Academy Super Admin.
-- Close privilege-escalation paths that bypass security-definer RPCs.
-- No new tables.

-- 1) Prefer super_admin when cleaning any stacked active memberships.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by
        case role::text
          when 'super_admin' then 1
          when 'admin' then 2
          when 'instructor' then 3
          when 'learner' then 4
          else 5
        end,
        granted_at desc nulls last,
        created_at desc
    ) as keep_rank
  from public.academy_memberships
  where status = 'active'
)
update public.academy_memberships m
set status = 'suspended',
    updated_at = now()
from ranked r
where m.id = r.id
  and r.keep_rank > 1;

-- 2) Privileged membership rows (admin / super_admin) are RPC-only.
-- Super Admins may still manage learner / instructor like plain Admins.
-- Direct client insert/update/delete of admin or super_admin must fail RLS
-- so self-grant, last-SA, and exclusive-role checks in RPCs cannot be skipped.

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
      -- is_academy_admin() includes Super Admin.
      public.is_academy_admin()
      and role in ('learner'::public.academy_role, 'instructor'::public.academy_role)
    )
  );

create policy academy_memberships_update on public.academy_memberships
  for update
  using (
    public.is_academy_admin()
    and role in ('learner'::public.academy_role, 'instructor'::public.academy_role)
  )
  with check (
    public.is_academy_admin()
    and role in ('learner'::public.academy_role, 'instructor'::public.academy_role)
  );

create policy academy_memberships_delete on public.academy_memberships
  for delete using (
    public.is_academy_admin()
    and role in ('learner'::public.academy_role, 'instructor'::public.academy_role)
  );

-- 3) Block self-grant on Admin RPC (mirrors Super Admin self-grant block).
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

grant execute on function public.academy_grant_admin(uuid) to authenticated;

comment on policy academy_memberships_insert on public.academy_memberships is
  'Learners self-provision; Admins/Super Admins may insert learner/instructor only. admin/super_admin rows require security-definer RPCs.';
comment on policy academy_memberships_update on public.academy_memberships is
  'Admins/Super Admins may update learner/instructor only. Privileged role changes go through RPCs.';
comment on policy academy_memberships_delete on public.academy_memberships is
  'Admins/Super Admins may delete learner/instructor only. Privileged roles are suspended via RPCs, not deleted.';
