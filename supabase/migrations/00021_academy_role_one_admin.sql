-- Academy has one admin role: academy_memberships.role = 'admin'.
-- That value is what the app and is_academy_admin() already use.
-- The live enum also had 'academy_admin', which was never part of the
-- product schema (00010 is learner | instructor | admin). Remove it.
--
-- Do not DROP ... CASCADE. Recreate the enum by converting every column
-- that uses academy_role (including live-only tables such as academy_roles),
-- after detaching policies that block ALTER TYPE.

-- Merge duplicate memberships first. unique(user_id, role) must still hold.
update public.academy_memberships as extra
set
  role = 'admin',
  updated_at = now()
where extra.role::text = 'academy_admin'
  and not exists (
    select 1
    from public.academy_memberships as kept
    where kept.user_id = extra.user_id
      and kept.role::text = 'admin'
  );

delete from public.academy_memberships
where role::text = 'academy_admin';

do $$
declare
  r record;
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'academy_role'
      and e.enumlabel = 'academy_admin'
  ) then
    return;
  end if;

  -- Map leftover academy_admin values on every table that uses the enum.
  for r in
    select n.nspname as schema_name, c.relname as table_name, a.attname as column_name
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where a.attnum > 0
      and not a.attisdropped
      and c.relkind in ('r', 'p')
      and n.nspname = 'public'
      and t.typname = 'academy_role'
  loop
    begin
      execute format(
        'update %I.%I set %I = %L::public.academy_role where %I::text = %L',
        r.schema_name, r.table_name, r.column_name, 'admin', r.column_name, 'academy_admin'
      );
    exception
      when unique_violation then
        execute format(
          'delete from %I.%I where %I::text = %L',
          r.schema_name, r.table_name, r.column_name, 'academy_admin'
        );
    end;
  end loop;

  -- Break SQL-function dependency on has_academy_role(academy_role)
  -- and on the old enum type (use text compares).
  execute $sql$
    create or replace function public.is_academy_admin()
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $fn$
      select exists (
        select 1
        from public.academy_memberships
        where user_id = auth.uid()
          and role::text = 'admin'
          and status = 'active'
      );
    $fn$;
  $sql$;

  execute $sql$
    create or replace function public.is_academy_instructor()
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $fn$
      select exists (
        select 1
        from public.academy_memberships
        where user_id = auth.uid()
          and role::text = 'instructor'
          and status = 'active'
      );
    $fn$;
  $sql$;

  create temporary table if not exists academy_role_policy_restore (
    seq serial primary key,
    ddl text not null
  ) on commit drop;

  delete from academy_role_policy_restore;

  insert into academy_role_policy_restore (ddl)
  select format(
    'create policy %I on %I.%I as %s for %s to %s%s%s',
    pol.polname,
    nsp.nspname,
    rel.relname,
    case when pol.polpermissive then 'permissive' else 'restrictive' end,
    case pol.polcmd
      when 'r' then 'select'
      when 'a' then 'insert'
      when 'w' then 'update'
      when 'd' then 'delete'
      else 'all'
    end,
    case
      when pol.polroles = '{0}'::oid[] then 'public'
      else coalesce((
        select string_agg(quote_ident(roles.rolname), ', ')
        from pg_roles as roles
        where roles.oid = any (pol.polroles)
      ), 'public')
    end,
    case
      when pol.polqual is not null
        then ' using (' || pg_get_expr(pol.polqual, pol.polrelid) || ')'
      else ''
    end,
    case
      when pol.polwithcheck is not null
        then ' with check (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')'
      else ''
    end
  )
  from pg_policy pol
  join pg_class rel on rel.oid = pol.polrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where (nsp.nspname, rel.relname) in (
    select n.nspname, c.relname
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where a.attnum > 0
      and not a.attisdropped
      and c.relkind in ('r', 'p')
      and t.typname = 'academy_role'
  )
     or coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%has_academy_role%'
     or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%has_academy_role%';

  for r in
    select nsp.nspname, rel.relname, pol.polname
    from pg_policy pol
    join pg_class rel on rel.oid = pol.polrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where (nsp.nspname, rel.relname) in (
      select n.nspname, c.relname
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_type t on t.oid = a.atttypid
      where a.attnum > 0
        and not a.attisdropped
        and c.relkind in ('r', 'p')
        and t.typname = 'academy_role'
    )
       or coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%has_academy_role%'
       or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%has_academy_role%'
  loop
    execute format('drop policy %I on %I.%I', r.polname, r.nspname, r.relname);
  end loop;

  execute 'drop function if exists public.has_academy_role(public.academy_role)';

  execute 'drop type if exists public.academy_role_new';
  execute $sql$
    create type public.academy_role_new as enum ('learner', 'instructor', 'admin')
  $sql$;

  for r in
    select n.nspname as schema_name, c.relname as table_name, a.attname as column_name
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where a.attnum > 0
      and not a.attisdropped
      and c.relkind in ('r', 'p')
      and n.nspname = 'public'
      and t.typname = 'academy_role'
  loop
    execute format(
      'alter table %I.%I alter column %I drop default',
      r.schema_name, r.table_name, r.column_name
    );
    execute format(
      'alter table %I.%I alter column %I type public.academy_role_new using (case when %I::text = %L then %L else %I::text end)::public.academy_role_new',
      r.schema_name, r.table_name, r.column_name,
      r.column_name, 'academy_admin', 'admin', r.column_name
    );
  end loop;

  execute 'drop type public.academy_role';
  execute 'alter type public.academy_role_new rename to academy_role';

  execute $sql$
    create or replace function public.has_academy_role(p_role public.academy_role)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $fn$
      select exists (
        select 1
        from public.academy_memberships
        where user_id = auth.uid()
          and role = p_role
          and status = 'active'
      );
    $fn$;
  $sql$;

  execute $sql$
    create or replace function public.is_academy_admin()
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $fn$
      select public.has_academy_role('admin');
    $fn$;
  $sql$;

  execute $sql$
    create or replace function public.is_academy_instructor()
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $fn$
      select public.has_academy_role('instructor');
    $fn$;
  $sql$;

  for r in
    select ddl from academy_role_policy_restore order by seq
  loop
    execute r.ddl;
  end loop;
end
$$;

grant execute on function public.has_academy_role(public.academy_role) to anon, authenticated, service_role;
grant execute on function public.is_academy_admin() to anon, authenticated, service_role;
grant execute on function public.is_academy_instructor() to anon, authenticated, service_role;
