-- What screen 2.1.2.1 grants.
--
-- Approving an access request sets a role and, separately, which areas that
-- person may reach — Requests, Messages, Documents, Billing. `role` on
-- `whitbyos_client_members` carries the first; nothing carries the second, so
-- approving could record who was let in but not what they were let into.
--
-- §13.14.13 describes presets rather than a fixed set of switches (an Assistant
-- sees the Members they support; a Limited Representative only selected
-- Requests), and §13.14.15 says adding someone to a Request grants that Request
-- and nothing else. A column per area would not survive either. So jsonb, and
-- the checkboxes of 2.1.2.1 are its first keys.
--
-- Empty means nothing has been decided, not that everything is allowed — the
-- code reads it that way and the portal already refuses anyone without
-- portal_access regardless.

alter table public.whitbyos_client_members
  add column if not exists permissions jsonb not null default '{}'::jsonb;
