-- Staff read cursor for partner support threads (WhatsApp-style receipts).
-- Unique 00041 prefix — do not collide with Academy migrations.

create table if not exists public.partner_message_staff_reads (
  partner_profile_id uuid primary key
    references public.partner_profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  reader_user_id uuid references public.users (id) on delete set null
);

alter table public.partner_message_staff_reads enable row level security;

grant select on public.partner_message_staff_reads to authenticated;
grant all on public.partner_message_staff_reads to service_role;

drop policy if exists partner_message_staff_reads_select
  on public.partner_message_staff_reads;
create policy partner_message_staff_reads_select
  on public.partner_message_staff_reads
  for select using (public.is_partner_member(partner_profile_id));

create or replace function public.partner_staff_mark_messages_read(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.partner_message_staff_reads (
    partner_profile_id,
    last_read_at,
    reader_user_id
  )
  values (p_profile_id, now(), auth.uid())
  on conflict (partner_profile_id)
  do update set
    last_read_at = excluded.last_read_at,
    reader_user_id = excluded.reader_user_id;
end;
$$;

revoke all on function public.partner_staff_mark_messages_read(uuid) from public;
grant execute on function public.partner_staff_mark_messages_read(uuid) to authenticated;
grant execute on function public.partner_staff_mark_messages_read(uuid) to service_role;

do $$ begin
  alter publication supabase_realtime add table public.partner_message_staff_reads;
exception
  when duplicate_object then null;
  when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.partner_message_reads;
exception
  when duplicate_object then null;
  when others then null;
end $$;
