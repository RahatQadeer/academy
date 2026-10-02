-- =====================================================================
-- Whitby — tasks keep the order somebody put them in
-- Owner: Sabahat (whitbyos_*)
--
-- Every view of a plan reads its tasks in the order they were created, which
-- is the order Whitby drafted them in and has nothing to do with the order
-- they are worked in. There was no way to say "this one first": the board, the
-- list, the table and the grid all showed the same drafting order, and moving
-- a card between columns was a dialog rather than a drag.
--
-- `sort_order` is a float rather than an integer on purpose. Dropping a task
-- between two others takes the midpoint of their two numbers, so one row is
-- written instead of renumbering everything under it.
--
-- Null means "never moved", and sorts after everything that has been placed,
-- by creation date as before. Nothing is reordered by this migration.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_tasks
  add column if not exists sort_order double precision;

create index if not exists whitbyos_tasks_order_idx
  on public.whitbyos_tasks (workstream_id, sort_order);


-- =====================================================================
-- VERIFY — the column, and how many tasks have been placed by hand.
-- =====================================================================
-- select count(*) filter (where sort_order is not null) as placed,
--        count(*) as total
-- from public.whitbyos_tasks;
