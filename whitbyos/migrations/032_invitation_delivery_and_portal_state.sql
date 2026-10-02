-- Two things the Contacts tab was guessing at.
--
-- 1. Whether the email actually left.
--
-- `sent_at` is written when the row is created, before the email is even
-- attempted, so it says when Whitby tried rather than whether anybody received
-- anything. An invitation whose email bounced looked identical to one sitting
-- in somebody's inbox, and the screen said "Invited" for both — while the toast
-- at the moment of sending had said the opposite.
--
-- 2. Whether they are actually in.
--
-- "Portal · Active" was read off `invitations.status`, which says a link was
-- used, not that an account reached the portal. The truthful answer is whether
-- `client_portal_identities` has a row — and a professional cannot read that
-- table: its only policy is `user_id = auth.uid()`, written for the client
-- reading their own. So every query from this side came back empty and the
-- screen had to fall back on the invitation.
--
-- This adds the missing half: a workspace member may see whether a contact on
-- one of their own clients has an account. Not who it is, not its address —
-- the row is only ever counted.

alter table public.invitations
  add column if not exists email_delivered boolean;

comment on column public.invitations.email_delivered is
  'null = never attempted, false = the provider refused it, true = it left.';

drop policy if exists client_portal_identities_select_staff
  on public.client_portal_identities;

create policy client_portal_identities_select_staff
  on public.client_portal_identities
  for select using (
    exists (
      select 1
        from public.whitbyos_client_members m
        join public.whitbyos_clients c on c.id = m.client_id
       where m.contact_id = client_portal_identities.contact_id
         and public.is_workspace_member(c.workspace_id)
    )
  );
