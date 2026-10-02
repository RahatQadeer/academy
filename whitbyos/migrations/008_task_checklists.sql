-- =====================================================================
-- Whitby — a Checklist that belongs to a Task
-- Owner: Sabahat (whitbyos_*)
--
-- WP.18's Edit Task modal carries a Checklist: tickable rows edited inside the
-- Task itself. The schema has `whitbyos_checklists`, but it hangs off a
-- Workstream and cannot say which Task a row belongs to.
--
-- That is a real disagreement between the two sources, not an oversight:
--
--   SRS §6.7.4  a Checklist is a repeatable step list used "when a full Task
--               record is unnecessary", specific to a Workstream
--   WP.18       a Checklist lives inside a Task, alongside its assignee and
--               due date
--
-- FLAGGED, not silently resolved — §6.7.4 stays as written and keeps working.
-- This adds a nullable `task_id` beside it, so one table serves both readings:
--
--   task_id is null      the Workstream checklist §6.7.4 describes — unchanged
--   task_id is set       the Task checklist WP.18 draws
--
-- `workstream_id` deliberately stays NOT NULL. A Task's checklist still sits in
-- that Task's Workstream, so every row keeps the scope the RLS policy in 002
-- reads (`whitbyos_checklists_staff` joins through workstream_id) and no policy
-- has to change. Relaxing it would have opened a hole for the sake of a column.
--
-- `items` keeps its existing jsonb shape, written as:
--   [{ "text": "Mayfair — 2BR", "done": true }, ...]
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_checklists
  add column if not exists task_id uuid
    references public.whitbyos_tasks (id) on delete cascade;

-- A Task shows one checklist in WP.18, so one row per Task.
create unique index if not exists whitbyos_checklists_task_id_key
  on public.whitbyos_checklists (task_id)
  where task_id is not null;

-- WP.18 reads the checklist every time the modal opens.
create index if not exists whitbyos_checklists_workstream_id_idx
  on public.whitbyos_checklists (workstream_id);


-- =====================================================================
-- VERIFY — should return one row: task_id | uuid | YES
-- =====================================================================
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_checklists'
--   and column_name = 'task_id';
