-- 17.6's session limit.
--
-- "Limit to one active session at a time" is enforced by the auth service, not
-- by the app — Supabase would have to refuse the second sign-in, which is a
-- project setting rather than something a per-user query can do.
--
-- The preference is still worth recording: it is a decision the workspace has
-- made, and whatever enforces it later needs somewhere to read it from. The
-- screen says plainly that it is recorded rather than active, so nobody
-- believes a control that is not yet holding.

alter table public.whitbyos_workspace_settings
  add column if not exists single_session boolean not null default false;
