-- Partner Center program support messages — owner: Zara (prefix partner_)
--
-- One thread per partner_profile_id: partners read/reply; staff messages are
-- inserted via service role or a future admin surface.

create type public.partner_message_sender_type as enum ('partner', 'staff');

create table public.partner_messages (
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

create index partner_messages_profile_created_idx
  on public.partner_messages (partner_profile_id, created_at);

create table public.partner_message_reads (
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (partner_profile_id, user_id)
);

alter table public.partner_messages enable row level security;
alter table public.partner_message_reads enable row level security;

-- partner_messages: members read their profile thread.
drop policy if exists partner_messages_select on public.partner_messages;
create policy partner_messages_select on public.partner_messages
  for select using (public.is_partner_member(partner_profile_id));

-- Partners may only insert their own messages — never staff.
drop policy if exists partner_messages_insert on public.partner_messages;
create policy partner_messages_insert on public.partner_messages
  for insert with check (
    public.is_partner_member(partner_profile_id)
    and sender_type = 'partner'
    and public.is_partner_contact(sender_contact_id)
  );

-- partner_message_reads: per-user read cursor.
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

-- Mark the inbox read without granting broad update on partner_messages.
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

-- Live refresh in Partner Center (same idea as whitbyos_messages for Client Portal).
alter publication supabase_realtime add table public.partner_messages;
