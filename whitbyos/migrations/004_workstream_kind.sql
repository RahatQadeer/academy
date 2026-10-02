-- =====================================================================
-- Whitby — workstream kind
-- Owner: Sabahat (whitbyos_*)
--
-- The Professional Figma shows each plan step carrying an Auto / Approval /
-- Manual pill. That vocabulary appears nowhere in the SRS or the schema.
--
-- Resolved as a hybrid: a plan is stored the way SRS §6.6 requires — a Workplan
-- of Workstreams, each with its own owner, status, target date, dependencies
-- and progress — while the screen renders them as the Figma's flat numbered
-- list. `kind` is the one field that presentation needs and the SRS does not
-- define, so it lives here rather than reshaping the model around the design.
--
-- A plain text column with a check constraint rather than a new enum type:
-- enums live in base's 00001 migration, and this stays inside a table Whitby
-- owns.
--
-- Meaning:
--   auto      Whitby may draft this itself — reversible internal work (§12.1.4)
--   approval  needs human review before it proceeds (§1.15)
--   manual    the professional does this
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_workstreams
  add column if not exists kind text not null default 'manual';

alter table public.whitbyos_workstreams
  drop constraint if exists whitbyos_workstreams_kind_check;

alter table public.whitbyos_workstreams
  add constraint whitbyos_workstreams_kind_check
  check (kind in ('auto', 'approval', 'manual'));


-- =====================================================================
-- VERIFY — should return one row: kind | text | 'manual'
-- =====================================================================
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_workstreams'
--   and column_name = 'kind';
