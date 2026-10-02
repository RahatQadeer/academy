-- Restore Academy Admin direct publish from Catalog.
-- 00014 allowed is_academy_admin() to set status = published.
-- 00015 replaced the trigger and RLS and required an approved
-- academy_publish_requests row for everyone, so Catalog Publish did nothing.

create or replace function public.academy_programs_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by_user_id is distinct from auth.uid()
       and not public.is_academy_admin() then
      raise exception 'academy_programs created_by_user_id must be the session user';
    end if;
    if new.status = 'published' and not public.is_academy_admin() then
      raise exception 'academy_programs insert cannot be published';
    end if;
    return new;
  end if;

  if new.created_by_user_id is distinct from old.created_by_user_id then
    raise exception 'academy_programs created_by_user_id cannot change';
  end if;

  if new.status = 'published' and old.status is distinct from 'published' then
    if public.is_academy_admin() then
      return new;
    end if;
    if public.academy_can_author_program(new.id)
       and public.academy_program_has_approved_publish(new.id) then
      update public.academy_publish_requests
      set
        published_by_user_id = coalesce(published_by_user_id, auth.uid()),
        published_at = coalesce(published_at, now())
      where id = (
        select r.id
        from public.academy_publish_requests r
        where r.program_id = new.id
          and r.status = 'approved'
        order by r.reviewed_at desc nulls last, r.created_at desc, r.id desc
        limit 1
      )
      and published_at is null;
      return new;
    end if;
    raise exception 'academy_programs publish requires admin approval';
  end if;

  return new;
end;
$$;

drop policy if exists academy_programs_update on public.academy_programs;
create policy academy_programs_update on public.academy_programs
  for update using (
    public.academy_can_author_program(id)
  )
  with check (
    public.academy_can_author_program(id)
    and (
      status is distinct from 'published'
      or public.is_academy_admin()
      or public.academy_program_has_approved_publish(id)
    )
  );

create or replace function public.academy_publish_program(p_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_program public.academy_programs%rowtype;
  v_request public.academy_publish_requests%rowtype;
  v_request_id uuid;
  v_now timestamptz := now();
begin
  if v_user is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if not public.has_academy_entitlement() then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  if p_program_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select *
  into v_program
  from public.academy_programs
  where id = p_program_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_program.status = 'published' then
    select *
    into v_request
    from public.academy_publish_requests
    where program_id = p_program_id
      and status = 'approved'
      and published_at is not null
    order by published_at desc, id desc
    limit 1;

    return jsonb_build_object(
      'status', 'already_published',
      'program_id', v_program.id,
      'published_at', v_request.published_at,
      'published_by_user_id', v_request.published_by_user_id
    );
  end if;

  if not (
    public.is_academy_admin()
    or (public.is_academy_instructor() and public.academy_can_author_program(p_program_id))
  ) then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  select r.id
  into v_request_id
  from public.academy_publish_requests r
  where r.program_id = p_program_id
    and r.status = 'approved'
  order by r.reviewed_at desc nulls last, r.created_at desc, r.id desc
  limit 1;

  if v_request_id is null and not public.is_academy_admin() then
    return jsonb_build_object('status', 'not_approved');
  end if;

  update public.academy_programs
  set
    status = 'published',
    updated_at = v_now
  where id = p_program_id
    and status is distinct from 'published';

  if not found then
    return jsonb_build_object('status', 'already_published', 'program_id', p_program_id);
  end if;

  if v_request_id is not null then
    update public.academy_publish_requests
    set
      published_by_user_id = v_user,
      published_at = v_now
    where id = v_request_id
      and published_at is null;

    select *
    into v_request
    from public.academy_publish_requests
    where id = v_request_id;
  end if;

  return jsonb_build_object(
    'status', 'published',
    'program_id', p_program_id,
    'published_at', coalesce(v_request.published_at, v_now),
    'published_by_user_id', coalesce(v_request.published_by_user_id, v_user)
  );
end;
$$;
