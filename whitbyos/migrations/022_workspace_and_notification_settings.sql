-- What screens 17.1 and 17.3 need to store.
--
-- 17.1 asks for a default currency and a set of client classifications, neither
-- of which exists anywhere. They go on `whitbyos_workspace_settings` rather
-- than `workspaces`: that table is base, shared by all four products, and a
-- classification for a Whitby client is not something the Academy or the
-- Partner Center has any use for. Name, URL and time zone stay where they are,
-- on `workspaces`, because those really are shared.
--
-- 17.3 is per person, not per workspace — two coordinators in one firm want to
-- hear about different things — and per workspace as well, since someone in two
-- firms should not have one firm's settings decide the other's.
--
-- Only what is switched OFF is stored. The export draws every toggle on, so
-- absence means on, and a fresh account gets the intended defaults without
-- anything having to write seven rows for it first.

alter table public.whitbyos_workspace_settings
  add column if not exists default_currency text not null default 'USD';

alter table public.whitbyos_workspace_settings
  add column if not exists client_classifications text[] not null
  default array['Family', 'Household', 'Company', 'Estate'];

create table if not exists public.whitbyos_notification_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_type text not null,
  channel text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id, event_type, channel)
);

alter table public.whitbyos_notification_prefs
  drop constraint if exists whitbyos_notification_prefs_channel_check;
alter table public.whitbyos_notification_prefs
  add constraint whitbyos_notification_prefs_channel_check
  check (channel in ('email', 'in_app'));

alter table public.whitbyos_notification_prefs enable row level security;

drop policy if exists whitbyos_notification_prefs_self on public.whitbyos_notification_prefs;

-- Yours alone. A teammate has no business reading, still less changing, what
-- you have chosen to be told about.
create policy whitbyos_notification_prefs_self
  on public.whitbyos_notification_prefs
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
