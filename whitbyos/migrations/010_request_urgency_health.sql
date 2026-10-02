-- =====================================================================
-- Whitby — urgency and health on a Request
-- Owner: Sabahat (whitbyos_*)
--
-- Migration 007 put `urgency` and `health` on `whitbyos_workplans`, because
-- that is where WP.2 and WP.17 show them. The updated export now asks for both
-- on the New Request form as well — screens 1.2 and 06a — where no plan exists
-- yet to hold them.
--
-- So they belong to the Request too. A Request is the outcome someone is
-- accountable for (§6.1); how urgent it is and how it is going are facts about
-- that outcome, and they are known before anyone has drafted a plan for it.
-- The plan inherits them when it is created and may then diverge — a plan can
-- be at risk while the Request as a whole is still on track.
--
-- Same shape as 007 so the two agree: plain text with a check constraint,
-- rather than an enum type living in base's 00001 migration.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_requests
  add column if not exists urgency text not null default 'medium';

alter table public.whitbyos_requests
  drop constraint if exists whitbyos_requests_urgency_check;
alter table public.whitbyos_requests
  add constraint whitbyos_requests_urgency_check
  check (urgency in ('critical', 'high', 'medium', 'low'));

alter table public.whitbyos_requests
  add column if not exists health text not null default 'on_track';

alter table public.whitbyos_requests
  drop constraint if exists whitbyos_requests_health_check;
alter table public.whitbyos_requests
  add constraint whitbyos_requests_health_check
  check (health in ('on_track', 'needs_attention', 'at_risk'));


-- =====================================================================
-- VERIFY — should return two rows: health, urgency
-- =====================================================================
-- select column_name, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_requests'
--   and column_name in ('urgency', 'health')
-- order by 1;
