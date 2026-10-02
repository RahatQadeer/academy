-- Client Portal schema — owner: Rohail.
-- Only these two tables. Requests, Documents, Forms, Messages, Updates, Calendar
-- are the same whitbyos_* records, presented through the permission layer.

create table public.client_portal_access_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.whitbyos_clients (id) on delete cascade,
  requested_by_contact_id uuid not null references public.contacts (id),
  person_name text not null,
  person_email text not null,
  relationship text,
  requested_role text,
  reason text,
  status public.client_portal_access_status not null default 'pending',
  reviewed_by_user_id uuid references public.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.client_portal_notification_prefs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  event_type text not null,
  channel text not null,
  enabled boolean not null default true,
  unique (contact_id, event_type, channel)
);

alter table public.client_portal_access_requests enable row level security;
alter table public.client_portal_notification_prefs enable row level security;

create policy client_portal_access_requests_all on public.client_portal_access_requests
  for all using (
    exists (
      select 1 from public.whitbyos_clients c
      where c.id = client_id and public.is_workspace_member(c.workspace_id)
    )
    or public.has_entitlement('client_portal')
  );

create policy client_portal_notification_prefs_all on public.client_portal_notification_prefs
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);
