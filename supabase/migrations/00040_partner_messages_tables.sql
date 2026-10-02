-- Partner support messages — unique version so deploy runners do not skip this
-- (00032 and 00039 partner message files share prefixes with Academy migrations).
-- Idempotent: safe if 00032/00039 already applied.

do $$ begin
  create type public.partner_message_sender_type as enum ('partner', 'staff');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.partner_messages (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  sender_type public.partner_message_sender_type not null,
  sender_contact_id uuid references public.contacts (id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint partner_messages_body_not_blank check (char_length(trim(body)) > 0),
  constraint partner_messages_partner_sender check (
    sender_type <> 'partner'
    or sender_contact_id is not null
  ),
  constraint partner_messages_staff_sender check (
    sender_type <> 'staff'
    or sender_contact_id is null
  )
);

create index if not exists partner_messages_profile_created_idx
  on public.partner_messages (partner_profile_id, created_at);

create table if not exists public.partner_message_reads (
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (partner_profile_id, user_id)
);

alter table public.partner_messages enable row level security;
alter table public.partner_message_reads enable row level security;

grant select, insert on public.partner_messages to authenticated;
grant all on public.partner_messages to service_role;
grant select, insert, update on public.partner_message_reads to authenticated;
grant all on public.partner_message_reads to service_role;

drop policy if exists partner_messages_select on public.partner_messages;
create policy partner_messages_select on public.partner_messages
  for select using (public.is_partner_member(partner_profile_id));

drop policy if exists partner_messages_insert on public.partner_messages;
create policy partner_messages_insert on public.partner_messages
  for insert with check (
    public.is_partner_member(partner_profile_id)
    and sender_type = 'partner'
    and public.is_partner_contact(sender_contact_id)
  );

drop policy if exists partner_message_reads_select on public.partner_message_reads;
create policy partner_message_reads_select on public.partner_message_reads
  for select using (
    public.is_partner_member(partner_profile_id)
    and user_id = auth.uid()
  );

drop policy if exists partner_message_reads_insert on public.partner_message_reads;
create policy partner_message_reads_insert on public.partner_message_reads
  for insert with check (
    public.is_partner_member(partner_profile_id)
    and user_id = auth.uid()
  );

drop policy if exists partner_message_reads_update on public.partner_message_reads;
create policy partner_message_reads_update on public.partner_message_reads
  for update using (
    public.is_partner_member(partner_profile_id)
    and user_id = auth.uid()
  )
  with check (
    public.is_partner_member(partner_profile_id)
    and user_id = auth.uid()
  );

create or replace function public.partner_mark_messages_read(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_partner_member(p_profile_id) then
    raise exception 'Not a member of this partner profile';
  end if;

  insert into public.partner_message_reads (partner_profile_id, user_id, last_read_at)
  values (p_profile_id, auth.uid(), now())
  on conflict (partner_profile_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.partner_mark_messages_read(uuid) from public;
grant execute on function public.partner_mark_messages_read(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.partner_messages;
exception
  when duplicate_object then null;
  when others then
    null;
end $$;
