-- A contact whose portal account was deleted.
--
-- Deleting the account removes the auth user, the identity link and portal
-- access — after which "they deleted their account", "they were never invited"
-- and "their access was turned off" are the same absence, and the professional
-- cannot tell which happened to a person they still work with.
--
-- The deletion itself is a fact worth keeping, separately from the login it
-- ended. It cannot live on `client_portal_identities`, whose row is gone and
-- whose user_id points at an auth user that no longer exists, and it does not
-- belong on `contacts`, which is shared by all four products and is about the
-- person rather than one product's account.
--
-- Their data stays, as it was: the contact, their Requests, Documents and
-- Messages. What changes is only that the professional can see the door was
-- closed from the inside.

create table if not exists public.client_portal_deletions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  -- Kept as text on purpose: the auth user is gone and this has to outlive it.
  email text,
  deleted_at timestamptz not null default now()
);

create index if not exists client_portal_deletions_contact_idx
  on public.client_portal_deletions (contact_id);

alter table public.client_portal_deletions enable row level security;

-- Written by the portal with the service role at the moment of deletion, and
-- read by the professional for any contact on one of their own clients. The
-- person it is about is gone by then, so there is nobody else to show it to.
drop policy if exists client_portal_deletions_staff on public.client_portal_deletions;

create policy client_portal_deletions_staff
  on public.client_portal_deletions
  for select using (
    exists (
      select 1
        from public.whitbyos_client_members m
        join public.whitbyos_clients c on c.id = m.client_id
       where m.contact_id = client_portal_deletions.contact_id
         and public.is_workspace_member(c.workspace_id)
    )
  );
