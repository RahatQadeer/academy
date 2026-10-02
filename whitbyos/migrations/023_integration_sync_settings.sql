-- Where 16.2's switches live.
--
-- The Manage modal turns three things on and off for a connected integration,
-- and `whitbyos_integrations` has nowhere to put them: it stores who is
-- connected, with what scopes, when it last synced and what went wrong, but
-- nothing about how the professional wants it to behave.
--
-- A jsonb column rather than three booleans, because the switches differ by
-- what is connected — a calendar is asked about declined events, a mailbox
-- about which addresses to file — and adding a column for each provider's own
-- questions would be a migration per integration.

alter table public.whitbyos_integrations
  add column if not exists sync_settings jsonb not null default '{}'::jsonb;
