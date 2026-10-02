-- Drop unused Auth-user read cursor for partner admin notifications.
-- Super Admin cookie sessions use partner_admin_notification_staff_reads
-- (staff_email). No application code reads or writes this table.

drop policy if exists partner_admin_notification_reads_select
  on public.partner_admin_notification_reads;
drop policy if exists partner_admin_notification_reads_insert
  on public.partner_admin_notification_reads;
drop policy if exists partner_admin_notification_reads_update
  on public.partner_admin_notification_reads;

drop table if exists public.partner_admin_notification_reads;
