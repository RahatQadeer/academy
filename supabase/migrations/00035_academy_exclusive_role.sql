-- One email / user_id may hold only one *active* Academy role at a time.
-- Learner, Instructor, and Admin do not stack. Suspend the current role
-- before granting another.

-- 1) Clean legacy stacked actives: keep admin > instructor > learner.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by
        case role::text
          when 'admin' then 1
          when 'instructor' then 2
          when 'learner' then 3
          else 4
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

-- 2) Block stacking on insert / reactivate.
create or replace function public.academy_memberships_enforce_exclusive_role()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'active' and exists (
    select 1
    from public.academy_memberships m
    where m.user_id = new.user_id
      and m.status = 'active'
      and m.role is distinct from new.role
      and (tg_op = 'INSERT' or m.id is distinct from new.id)
  ) then
    raise exception 'academy_role_conflict'
      using message = 'One email can only hold one active Academy role at a time';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_memberships_enforce_exclusive_role on public.academy_memberships;
create trigger academy_memberships_enforce_exclusive_role
  before insert or update of role, status on public.academy_memberships
  for each row execute function public.academy_memberships_enforce_exclusive_role();

-- 3) Grant Admin refuses other active roles (does not auto-replace).
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
