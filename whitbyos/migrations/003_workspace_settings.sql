-- =====================================================================
-- Whitby — workspace settings
-- Owner: Sabahat (whitbyos_*)
--
-- Somewhere to keep the onboarding work-type selections (SRS §4.3.3), which
-- personalise Playbooks, examples, recommendations and Whitby's guidance for
-- the workspace. Until now step 2 collected them and threw them away.
--
-- This is a whitbyos_ table rather than a column on the shared `workspaces`
-- table on purpose: the selections steer Whitby's behaviour specifically, and
-- §4.3.4 is explicit that they must never split the product or leak into how
-- other modules work. Base stays untouched.
--
-- Safe to re-run.
-- =====================================================================

create table if not exists public.whitbyos_workspace_settings (
  workspace_id uuid primary key
    references public.workspaces (id) on delete cascade,
  work_types jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whitbyos_workspace_settings enable row level security;

drop policy if exists whitbyos_workspace_settings_staff
  on public.whitbyos_workspace_settings;

create policy whitbyos_workspace_settings_staff
  on public.whitbyos_workspace_settings
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));


-- =====================================================================
-- VERIFY — should return one row.
-- =====================================================================
-- select c.relname as table_name, p.polname as policy_name
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- left join pg_policy p on p.polrelid = c.oid
-- where n.nspname = 'public'
--   and c.relname = 'whitbyos_workspace_settings';
