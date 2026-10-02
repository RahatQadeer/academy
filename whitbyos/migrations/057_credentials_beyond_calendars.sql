-- 057 — the credentials table stops assuming every integration is a calendar.
--
-- whitbyos_integration_credentials was written for Google Calendar and its
-- `calendar_id` is NOT NULL. Screen 16 offers nine apps, and a Slack workspace
-- or a DocuSign account has no calendar to name, so the column becomes
-- optional rather than being filled with a placeholder that means nothing.
--
-- `external_account_id` is what the rest of them do have: a Slack team id, an
-- Intuit realm id, a DocuSign account guid. One column, because every one of
-- them is the same thing: which account at the provider this grant belongs to.

alter table public.whitbyos_integration_credentials
  alter column calendar_id drop not null;

alter table public.whitbyos_integration_credentials
  add column if not exists external_account_id text;
