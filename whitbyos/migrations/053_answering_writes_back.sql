-- Answering a deletion request has to be able to say so.
--
-- 052 gave notifications two policies: a workspace member reaches rows in their
-- workspace, and somebody in the Client Portal reaches rows addressed to them.
-- Neither covers the moment that matters — a client accepting or declining has
-- to write a notification addressed to the *professional* who asked, and a
-- client is not a member of that workspace.
--
-- Measured: the decline was recorded and the reply was silently dropped, so the
-- professional was never told what had been decided about their own request.
--
-- Narrow on purpose. It permits exactly one row: one that hangs off a deletion
-- request this person is entitled to answer. It cannot be used to write a
-- notification to somebody about anything else.

drop policy if exists whitbyos_notifications_portal_reply on public.whitbyos_notifications;
create policy whitbyos_notifications_portal_reply
  on public.whitbyos_notifications for insert
  with check (
    deletion_request_id in (
      select r.id
      from public.whitbyos_deletion_requests r
      join public.whitbyos_client_members m on m.client_id = r.client_id
      join public.client_portal_identities i on i.contact_id = m.contact_id
      where i.user_id = auth.uid()
    )
  );
