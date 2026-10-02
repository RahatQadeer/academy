-- =====================================================================
-- Whitby — request work summary
-- Owner: Sabahat (whitbyos_*)
--
-- SRS §6.16.1 makes a final Work Summary part of closing a Request, and
-- §6.16.2 allows an approved one to be shared with the client. The Figma's
-- completed-request screen shows it as its own section. There was nowhere to
-- put it.
--
-- Kept on the Request rather than in `whitbyos_updates`, which §6.15.2 is
-- explicit about keeping separate: a Progress Update tells the client where
-- things stand mid-flight, a Work Summary is the closing record. Merging them
-- is called out in the SRS as something the system must never do.
--
-- `closed_at` already exists, so closing needs no other column.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_requests
  add column if not exists work_summary text;

alter table public.whitbyos_requests
  add column if not exists closed_by_user_id uuid references public.users (id);


-- =====================================================================
-- VERIFY — should return two rows.
-- =====================================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_requests'
--   and column_name in ('work_summary', 'closed_by_user_id')
-- order by 1;
