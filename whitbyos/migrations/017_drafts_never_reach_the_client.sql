-- Drafts must not reach the client portal.
--
-- This is fallout from 014. Before drafts existed, every row in
-- `whitbyos_messages` was something that had been said, so the portal's read
-- policy did not need to ask which kind it was:
--
--   create policy whitbyos_messages_select_client on public.whitbyos_messages
--     for select using (portal_in_thread(thread_id) and ...history window...)
--
-- Adding `status` gave the table a second kind of row — one that has been typed
-- but deliberately not sent — and the portal reads the same rows WhitbyOS
-- writes (client-portal/lib/data/messages.ts). Nothing in that path filters on
-- status, so a half-written reply, autosaved mid-sentence, would appear in the
-- client's portal as though it had been sent to them.
--
-- The fix belongs in the policy rather than in the query. A draft is not
-- something the client is merely not shown; it is something they must not be
-- able to read, and that has to hold for any query anyone writes later.
--
-- The professional's own view is unaffected: WhitbyOS reads through the
-- workspace policy, not this one.

drop policy if exists whitbyos_messages_select_client on public.whitbyos_messages;

create policy whitbyos_messages_select_client on public.whitbyos_messages
  for select using (
    status = 'sent'
    and public.portal_in_thread(thread_id)
    and (
      public.portal_thread_history_from(thread_id) is null
      or created_at >= public.portal_thread_history_from(thread_id)
    )
  );

-- A message written from the portal is sent by definition — there is no draft
-- state on that side — so it may never arrive as anything else.
drop policy if exists whitbyos_messages_insert_client on public.whitbyos_messages;

create policy whitbyos_messages_insert_client on public.whitbyos_messages
  for insert with check (
    status = 'sent'
    and public.portal_in_thread(thread_id)
    and sender_type = 'contact'
    and sender_id = public.portal_contact_id()
  );
