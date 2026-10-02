-- Which widgets a person keeps on their Home screen (17.3's sibling, screen 1.3).
--
-- Per person and per workspace, for the same reason notification preferences
-- are: two coordinators in one firm watch different things, and someone in two
-- firms should not have one decide the other.
--
-- Only what is switched OFF is stored, so a new account gets the full set the
-- export draws without anything having to write a row for it first.

create table if not exists public.whitbyos_dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  widget_key text not null,
  enabled boolean not null default true,
  unique (user_id, workspace_id, widget_key)
);

alter table public.whitbyos_dashboard_widgets enable row level security;

drop policy if exists whitbyos_dashboard_widgets_self on public.whitbyos_dashboard_widgets;

create policy whitbyos_dashboard_widgets_self
  on public.whitbyos_dashboard_widgets
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
