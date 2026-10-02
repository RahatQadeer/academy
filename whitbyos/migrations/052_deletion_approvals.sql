-- Deleting something asks the other side first, and a notification carries the ask.
--
-- Sabahat's rule, 2026-09-03: nothing offers Delete where it is used. Archive is
-- the only action there, and Delete lives on the Archive screen. From there, a
-- record younger than fifteen minutes goes at once — that is the window for
-- undoing a mistake you just made. Anything older belongs to the relationship
-- as much as to whoever is holding the mouse, so it is a request rather than an
-- act: the professional asks the client, the client asks the professional, and
-- it is not deleted until the other side accepts.
--
-- Two tables, because they answer two questions.
--
-- `whitbyos_deletion_requests` is the ask itself and its outcome. It keeps
-- `entity_label` because the whole point is that the row it names may be gone
-- by the time anybody reads the history — "Deleted: Hartwell Family" has to
-- survive the deletion of Hartwell Family.
--
-- `whitbyos_notifications` is what a person sees. Kept general rather than
-- deletion-specific: it carries a kind, a line of text and somewhere to go, so
-- the bell can hold more than this one thing later without another table.
-- A row addresses exactly one side — `recipient_user_id` for a professional,
-- `recipient_contact_id` for someone in the Client Portal.

create table if not exists public.whitbyos_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- Whose record it is, and therefore who is asked when a professional asks.
  client_id uuid references public.whitbyos_clients(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  -- Read after the row is gone.
  entity_label text not null,
  reason text,
  -- Exactly one of these two is set: it says which side is asking.
  requested_by_user_id uuid references public.users(id) on delete set null,
  requested_by_contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'pending',
  decided_by_user_id uuid references public.users(id) on delete set null,
  decided_by_contact_id uuid references public.contacts(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whitbyos_deletion_requests_open_idx
  on public.whitbyos_deletion_requests (workspace_id, status);

create index if not exists whitbyos_deletion_requests_entity_idx
  on public.whitbyos_deletion_requests (entity_type, entity_id);

create table if not exists public.whitbyos_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  recipient_user_id uuid references public.users(id) on delete cascade,
  recipient_contact_id uuid references public.contacts(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  entity_type text,
  entity_id uuid,
  deletion_request_id uuid references public.whitbyos_deletion_requests(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whitbyos_notifications_user_idx
  on public.whitbyos_notifications (recipient_user_id, read_at, created_at desc);

create index if not exists whitbyos_notifications_contact_idx
  on public.whitbyos_notifications (recipient_contact_id, read_at, created_at desc);

alter table public.whitbyos_deletion_requests enable row level security;
alter table public.whitbyos_notifications enable row level security;

-- A professional reaches both through their workspace, the way every other
-- Whitby table is reached. `is_workspace_member()` is the helper the rest of
-- the schema already uses.
drop policy if exists whitbyos_deletion_requests_member on public.whitbyos_deletion_requests;
create policy whitbyos_deletion_requests_member
  on public.whitbyos_deletion_requests for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists whitbyos_notifications_member on public.whitbyos_notifications;
create policy whitbyos_notifications_member
  on public.whitbyos_notifications for all
  using (workspace_id is not null and public.is_workspace_member(workspace_id))
  with check (workspace_id is not null and public.is_workspace_member(workspace_id));

-- Someone in the Client Portal sees only what is addressed to them, found
-- through the identity that says which contact they are.
drop policy if exists whitbyos_notifications_portal on public.whitbyos_notifications;
create policy whitbyos_notifications_portal
  on public.whitbyos_notifications for all
  using (
    recipient_contact_id in (
      select contact_id from public.client_portal_identities where user_id = auth.uid()
    )
  )
  with check (
    recipient_contact_id in (
      select contact_id from public.client_portal_identities where user_id = auth.uid()
    )
  );

drop policy if exists whitbyos_deletion_requests_portal on public.whitbyos_deletion_requests;
create policy whitbyos_deletion_requests_portal
  on public.whitbyos_deletion_requests for all
  using (
    client_id in (
      select m.client_id
      from public.whitbyos_client_members m
      join public.client_portal_identities i on i.contact_id = m.contact_id
      where i.user_id = auth.uid()
    )
  )
  with check (
    client_id in (
      select m.client_id
      from public.whitbyos_client_members m
      join public.client_portal_identities i on i.contact_id = m.contact_id
      where i.user_id = auth.uid()
    )
  );
