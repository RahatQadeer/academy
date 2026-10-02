-- Grants for partner in-app notifications (was missing from 00042).
-- Matches partner_messages grant pattern so authenticated can SELECT under RLS
-- and service_role can insert/manage.

grant select on public.partner_notifications to authenticated;
grant all on public.partner_notifications to service_role;

grant select, insert, update on public.partner_notification_reads to authenticated;
grant all on public.partner_notification_reads to service_role;
