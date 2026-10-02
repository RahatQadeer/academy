-- Academy Instructor role provisioning lookup (PA-ACA-019).
-- Academy-owned. Lets an Academy Admin search Base identity fields in order
-- to grant or revoke academy_memberships.role = instructor.
-- Does not change public.users RLS, columns, or authentication.
-- Does not return secrets. Does not grant Academy Admin.
-- unique(user_id, role) on academy_memberships is unchanged.

create or replace function public.academy_search_users_for_instructor_grant(p_query text)
returns table (
  id uuid,
  preferred_name text,
  full_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text;
begin
  if not (public.has_academy_entitlement() and public.is_academy_admin()) then
    return;
  end if;

  q := trim(both from coalesce(p_query, ''));
  q := replace(replace(q, '%', ''), '_', '');
  if char_length(q) < 2 then
    return;
  end if;
  q := left(q, 80);

  return query
  select u.id, u.preferred_name, u.full_name, u.email
  from public.users u
  where u.status = 'active'
    and (
      u.email ilike '%' || q || '%'
      or u.full_name ilike '%' || q || '%'
      or coalesce(u.preferred_name, '') ilike '%' || q || '%'
      or u.id::text ilike q || '%'
    )
  order by u.full_name asc
  limit 12;
end;
$$;

create or replace function public.academy_admin_user_identities(p_user_ids uuid[])
returns table (
  id uuid,
  preferred_name text,
  full_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_academy_entitlement() and public.is_academy_admin()) then
    return;
  end if;

  if p_user_ids is null or coalesce(array_length(p_user_ids, 1), 0) = 0 then
    return;
  end if;

  return query
  select u.id, u.preferred_name, u.full_name, u.email
  from public.users u
  where u.id = any (p_user_ids[1:48])
  limit 48;
end;
$$;

revoke all on function public.academy_search_users_for_instructor_grant(text) from public;
revoke all on function public.academy_admin_user_identities(uuid[]) from public;
grant execute on function public.academy_search_users_for_instructor_grant(text) to authenticated;
grant execute on function public.academy_admin_user_identities(uuid[]) to authenticated;
