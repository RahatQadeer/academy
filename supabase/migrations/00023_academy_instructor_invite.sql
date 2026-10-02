-- Academy instructor invitations reuse base invitations with context academy_instructor.
-- role_or_relationship stores JSON: {"programIds":["uuid",...],"permission":"edit"}

alter type public.invitation_context_type add value if not exists 'academy_instructor';

create or replace function public.academy_accept_instructor_invitation(
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
  payload jsonb;
  program_id uuid;
  permission_level text;
begin
  if p_user_id is null or p_token is null or char_length(trim(p_token)) = 0 then
    raise exception 'Invalid instructor invitation';
  end if;

  select *
  into inv
  from public.invitations
  where token = trim(p_token)
    and context_type = 'academy_instructor'
    and status = 'pending'
  limit 1;

  if not found then
    raise exception 'Instructor invitation not found';
  end if;

  if inv.expires_at is not null and inv.expires_at < now() then
    update public.invitations
    set status = 'expired'
    where id = inv.id;
    raise exception 'Instructor invitation has expired';
  end if;

  if lower(trim(inv.invitee_email)) <> (
    select lower(trim(u.email))
    from public.users u
    where u.id = p_user_id
  ) then
    raise exception 'Invitation email does not match this account';
  end if;

  payload := coalesce(inv.role_or_relationship::jsonb, '{}'::jsonb);
  permission_level := coalesce(payload ->> 'permission', 'edit');
  if permission_level not in ('edit', 'create') then
    permission_level := 'edit';
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

  insert into public.academy_memberships (user_id, role, status, granted_by_user_id, granted_at)
  values (p_user_id, 'instructor', 'active', inv.inviter_user_id, now())
  on conflict (user_id, role) do update
  set
    status = 'active',
    granted_by_user_id = excluded.granted_by_user_id,
    granted_at = excluded.granted_at,
    updated_at = now();

  for program_id in
    select jsonb_array_elements_text(coalesce(payload -> 'programIds', '[]'::jsonb))::uuid
  loop
    insert into public.academy_instructor_assignments (
      user_id,
      program_id,
      permission_level,
      assigned_by_admin_user_id
    )
    select p_user_id, program_id, permission_level, inv.inviter_user_id
    where not exists (
      select 1
      from public.academy_instructor_assignments a
      where a.user_id = p_user_id
        and a.program_id = program_id
    );
  end loop;

  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = inv.id;
end;
$$;

revoke all on function public.academy_accept_instructor_invitation(text, uuid) from public;
grant execute on function public.academy_accept_instructor_invitation(text, uuid) to authenticated, service_role;
