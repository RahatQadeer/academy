-- =====================================================================
-- Whitby — archiving a Work Plan, and never losing one
-- Owner: Sabahat (whitbyos_*)
--
-- Work Plans v2 replaces "Delete this Work Plan" with Archive / Delete
-- permanently, and Settings 17.7 adds one place to restore anything archived
-- across the workspace. The client settled three things this depends on:
--
--   1. A Request may carry more than one Work Plan. Today it may not — the
--      column is unique, so archiving a plan would leave its Request unusable
--      for ever, which is the opposite of what archiving is for.
--
--   2. Archived is not a status. `whitbyos_workplan_status` says what the work
--      is doing — draft, active, paused, complete — and a plan can be archived
--      in any of them. Folding the two together would lose the difference
--      between "paused" and "filed away".
--
--   3. Nothing leaves the database. "Delete permanently" means gone from every
--      screen and not restorable from the Archive; it does not mean the row is
--      destroyed. So it is a second timestamp rather than a DELETE.
--
-- Safe to re-run.
-- =====================================================================

-- 1 — a Request may carry more than one plan
alter table public.whitbyos_workplans
  drop constraint if exists whitbyos_workplans_request_id_key;

-- The lookups that used to lean on the unique index still need one.
create index if not exists whitbyos_workplans_request_idx
  on public.whitbyos_workplans (request_id);


-- 2 — archived, and by whom
alter table public.whitbyos_workplans
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid references public.users (id);


-- 3 — removed from every screen, still in the database
alter table public.whitbyos_workplans
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references public.users (id);


-- Every list, chart and count reads the live plans, which is most of the reads
-- this table gets. A partial index keeps that the cheap path.
create index if not exists whitbyos_workplans_live_idx
  on public.whitbyos_workplans (request_id)
  where archived_at is null and deleted_at is null;

-- Settings 17.7 reads the other direction: what is archived, newest first.
create index if not exists whitbyos_workplans_archived_idx
  on public.whitbyos_workplans (archived_at desc)
  where archived_at is not null and deleted_at is null;


-- =====================================================================
-- VERIFY
-- =====================================================================
-- -- four nullable columns:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'whitbyos_workplans'
--   and column_name in ('archived_at','archived_by_user_id','deleted_at','deleted_by_user_id')
-- order by column_name;
--
-- -- and no unique constraint left on request_id:
-- select conname, contype
-- from pg_constraint
-- where conrelid = 'public.whitbyos_workplans'::regclass and contype = 'u';
