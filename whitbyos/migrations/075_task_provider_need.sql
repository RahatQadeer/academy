-- =====================================================================
-- Whitby — the outside firm a task needs but the workspace does not have
-- Owner: Sabahat (whitbyos_*)
--
-- A drafted step can say it needs an outside firm. Where the workspace's own
-- directory holds a suitable one, `provider_id` names it and the task carries
-- that provider's real phone number. Where it does not — a property valuation
-- firm in Islamabad, for a firm that has never used one — the drafter's answer
-- was thrown away: the category and the reason went nowhere, so the plan said
-- "Identify and appoint a property valuation provider" and nothing anywhere
-- said what kind of firm, or why, or that this was a gap in the directory.
--
-- This keeps it. A jsonb column rather than two text ones because the shape is
-- the drafter's own and may gain a field:
--
--   { "category": "Property valuation firm, Islamabad",
--     "why": "A registered valuer's report is required before the transfer" }
--
-- Null means the task needs nobody outside, which is most tasks.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_tasks
  add column if not exists provider_need jsonb;

comment on column public.whitbyos_tasks.provider_need is
  'The kind of outside firm this task needs, where the workspace has none matching. Null when it needs nobody, or when provider_id already names one.';
