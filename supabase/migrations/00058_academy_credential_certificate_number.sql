-- 7-digit public certificate numbers. Display prefixes (PASE / PACC / PACP) are
-- visual only; verification resolves by this number alone.

alter table public.academy_credentials
  add column if not exists certificate_number text;

alter table public.academy_credentials
  drop constraint if exists academy_credentials_certificate_number_format;

alter table public.academy_credentials
  add constraint academy_credentials_certificate_number_format
  check (
    certificate_number is null
    or certificate_number ~ '^[0-9]{7}$'
  );

create unique index if not exists academy_credentials_certificate_number_uidx
  on public.academy_credentials (certificate_number)
  where certificate_number is not null;

create sequence if not exists public.academy_certificate_number_seq
  as bigint
  start with 1000000
  increment by 1
  minvalue 1000000
  maxvalue 9999999
  no cycle;

create or replace function public.academy_next_certificate_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  attempts int := 0;
begin
  loop
    attempts := attempts + 1;
    if attempts > 25 then
      raise exception 'Could not allocate a unique certificate number';
    end if;

    begin
      candidate := lpad(nextval('public.academy_certificate_number_seq')::text, 7, '0');
    exception
      when others then
        -- Sequence exhausted or not ready — fall back to a random 7-digit draw.
        candidate := lpad((1000000 + floor(random() * 9000000)::int)::text, 7, '0');
    end;

    if not exists (
      select 1
      from public.academy_credentials c
      where c.certificate_number = candidate
    ) then
      return candidate;
    end if;
  end loop;
end;
$$;

revoke all on function public.academy_next_certificate_number() from public;
grant execute on function public.academy_next_certificate_number() to authenticated, service_role;

-- Backfill awarded credentials that predate this column.
do $$
declare
  r record;
  n text;
  max_used bigint := 999999;
begin
  for r in
    select id
    from public.academy_credentials
    where status = 'awarded'
      and certificate_number is null
    order by awarded_at nulls last, id
  loop
    n := public.academy_next_certificate_number();
    update public.academy_credentials
    set certificate_number = n
    where id = r.id;
    max_used := greatest(max_used, n::bigint);
  end loop;

  -- Keep the sequence ahead of anything we assigned.
  if max_used >= 1000000 then
    perform setval(
      'public.academy_certificate_number_seq',
      max_used,
      true
    );
  end if;
end $$;
