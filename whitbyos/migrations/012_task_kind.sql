-- =====================================================================
-- Whitby — a Task carries the Auto / Approval / Manual classification
-- Owner: Sabahat (whitbyos_*)
--
-- Migration 004 put `kind` on `whitbyos_workstreams`, because the export of
-- the time drew a drafted plan as one flat numbered list and each entry
-- carried the pill. The current export (screen 3.2) draws two levels:
--
--   Work Stream · Research & Planning              3 steps
--      1. Research top international schools          [Auto]
--      2. Compile admissions requirements             [Auto]
--      3. Draft comparison summary for client review  [Approval]
--
-- So the classification belongs to the step, and a step is a Task
-- (SRS §6.7.1) — which matches the meaning better than the old shape did.
-- §1.15 asks whether *this particular piece of work* may be done without a
-- person, and that question is about a task, not about a whole component:
-- "Housing Search" is not auto or manual, but "draft the shortlist" is.
--
-- `kind` stays on the Workstream as well. Nothing reads it there any more, but
-- dropping a column is not reversible and existing rows carry values; it can
-- go once the draft flow has run for a while on the new shape.
--
-- Same form as 004 so the two agree: plain text with a check constraint,
-- rather than an enum type living in base's 00001 migration.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_tasks
  add column if not exists kind text not null default 'manual';

alter table public.whitbyos_tasks
  drop constraint if exists whitbyos_tasks_kind_check;

alter table public.whitbyos_tasks
  add constraint whitbyos_tasks_kind_check
  check (kind in ('auto', 'approval', 'manual'));


-- =====================================================================
-- VERIFY — should return one row: kind | text | 'manual'
-- =====================================================================
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_tasks'
--   and column_name = 'kind';
