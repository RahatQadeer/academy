-- Super Admin staff (cookie email, no public.users row) need their own
-- notification read cursor. partner_admin_notification_reads requires user_id.

create table if not exists public.partner_admin_notification_staff_reads (
  notification_id uuid not null
    references public.partner_admin_notifications (id) on delete cascade,
  staff_email text not null,
  read_at timestamptz not null default now(),
  primary key (notification_id, staff_email)
);

create index if not exists partner_admin_notification_staff_reads_email_idx
  on public.partner_admin_notification_staff_reads (lower(btrim(staff_email)));

alter table public.partner_admin_notification_staff_reads enable row level security;

revoke all on public.partner_admin_notification_staff_reads from public;
revoke all on public.partner_admin_notification_staff_reads from anon;
revoke all on public.partner_admin_notification_staff_reads from authenticated;
grant all on public.partner_admin_notification_staff_reads to service_role;
