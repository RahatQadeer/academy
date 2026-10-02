-- Reports.
--
-- The one module with nothing behind it. Screens 15, 15.1 and 15.3 draw a list
-- of generated reports, a modal that makes one, and a report that has been
-- made — none of which has anywhere to live.
--
-- What a report contains is computed at the moment it is generated, and then
-- fixed. That is the point of it: "Hartwell Family — Q1 Relocation Summary,
-- Jan 1 – Mar 31" is what was true on 12 March, and re-deriving it later from
-- live rows would silently rewrite a document someone has already read and
-- possibly sent to a client. So the figures are stored on the row.
--
-- `scheduled` is one row that has not been generated yet and has a date it will
-- be. The export lists it beside the others with "Next: Apr 1" where a
-- generated date would go, which is the same shape.

create table if not exists public.whitbyos_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  type text not null,
  client_id uuid references public.whitbyos_clients (id) on delete set null,
  period_start date,
  period_end date,
  -- Everything the report says, as it was when it was made.
  contents jsonb not null default '{}'::jsonb,
  shared_with_client boolean not null default false,
  scheduled_for date,
  generated_at timestamptz,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

create index if not exists whitbyos_reports_workspace_idx
  on public.whitbyos_reports (workspace_id, created_at desc);

alter table public.whitbyos_reports enable row level security;

drop policy if exists whitbyos_reports_staff on public.whitbyos_reports;

create policy whitbyos_reports_staff
  on public.whitbyos_reports
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
