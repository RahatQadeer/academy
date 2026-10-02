-- Partner Center admin push notifications (SRS §17.6.3)

create table public.partner_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  body text,
  href text,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index partner_admin_notifications_created_idx
  on public.partner_admin_notifications (created_at desc);

create table public.partner_admin_notification_reads (
  notification_id uuid not null
    references public.partner_admin_notifications (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.partner_admin_notifications enable row level security;
alter table public.partner_admin_notification_reads enable row level security;

-- Staff admin UI: any signed-in user can read notifications and mark their own reads.
drop policy if exists partner_admin_notifications_select on public.partner_admin_notifications;
create policy partner_admin_notifications_select on public.partner_admin_notifications
  for select using (auth.uid() is not null);

drop policy if exists partner_admin_notification_reads_select on public.partner_admin_notification_reads;
create policy partner_admin_notification_reads_select on public.partner_admin_notification_reads
  for select using (user_id = auth.uid());

drop policy if exists partner_admin_notification_reads_insert on public.partner_admin_notification_reads;
create policy partner_admin_notification_reads_insert on public.partner_admin_notification_reads
  for insert with check (user_id = auth.uid());

drop policy if exists partner_admin_notification_reads_update on public.partner_admin_notification_reads;
create policy partner_admin_notification_reads_update on public.partner_admin_notification_reads
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts use service role only (server actions after partner submit).

alter publication supabase_realtime add table public.partner_admin_notifications;
