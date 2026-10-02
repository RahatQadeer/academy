-- =====================================================================
-- Whitby — when a task was finished
-- Owner: Sabahat (whitbyos_*)
--
-- WP.17j draws a plan's progress over time: a trend under each stat tile, and
-- a cumulative "complete vs plan" line with a forecast. Both need the date a
-- task was completed, and `whitbyos_tasks` has never recorded it. It has
-- `created_at`, and `updated_at`, which is not the same thing — a task
-- finished in March and edited in May reports May, so every chart built on it
-- would drift as people tidy up old work.
--
-- Written when a task moves into a completed status and cleared when it moves
-- back out, so reopening a task does not leave it claiming a completion that
-- was undone.
--
-- Deliberately not backfilled. Existing completed tasks have no honest date to
-- give them — the only candidate is `updated_at`, which is exactly the wrong
-- answer this column exists to avoid. They stay null, which the charts read as
-- "complete, date unknown" and leave out of the trend rather than inventing a
-- point on it.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_tasks
  add column if not exists completed_at timestamptz;

-- The charts read one plan's completions in date order.
create index if not exists whitbyos_tasks_completed_idx
  on public.whitbyos_tasks (workstream_id, completed_at)
  where completed_at is not null;


-- =====================================================================
-- VERIFY — should return one row, nullable.
-- =====================================================================
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_tasks'
--   and column_name = 'completed_at';
