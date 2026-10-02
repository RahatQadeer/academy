-- =====================================================================
-- Whitby — a Task may be blocked by a Work Stream
-- Owner: Sabahat (whitbyos_*)
--
-- The (5) export answers a question sent upstream: WP.18 now carries a
-- Dependency field, and its options are
--
--   None
--   Blocked by: Visa & Immigration (Work Stream)
--   Blocking: Book moving company
--
-- `whitbyos_tasks.dependency_task_id` already holds task-to-task. The first
-- option is task-to-Workstream, which nothing in the schema can express:
-- `whitbyos_workstream_dependencies` records Workstream-to-Workstream and
-- Workstream-to-Task, never Task-to-Workstream.
--
-- So one nullable column beside the existing one, rather than reshaping a
-- table base owns. A Task may name at most one blocker of each kind; the
-- screen offers one Dependency, so in practice it holds one or the other.
--
-- "Blocking" is deliberately not stored. It is the same edge read from the
-- other end — the task being blocked records it — and storing both directions
-- means two rows that can disagree about one fact.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_tasks
  add column if not exists dependency_workstream_id uuid
    references public.whitbyos_workstreams (id) on delete set null;

create index if not exists whitbyos_tasks_dependency_workstream_id_idx
  on public.whitbyos_tasks (dependency_workstream_id)
  where dependency_workstream_id is not null;


-- =====================================================================
-- VERIFY — should return one row: dependency_workstream_id | uuid | YES
-- =====================================================================
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_tasks'
--   and column_name = 'dependency_workstream_id';
