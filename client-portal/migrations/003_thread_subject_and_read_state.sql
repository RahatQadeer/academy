-- =====================================================================
-- Thread subject and read state for the portal.
-- Proposed by: Rohail (client-portal). Owner / sign-off: Laiba (base).
--
-- Follow-on from whitbyos/014, which turned a thread from "the messages
-- sharing this id" into a row of its own carrying `subject`, and gave
-- `whitbyos_message_participants` a `last_read_at`. The portal was written
-- before either existed and still infers both:
--
--   * the subject came from the linked Request's title, falling back to
--     "Conversation" — but WhitbyOS can now start a thread with no Request at
--     all, and those carry a real subject the portal was not reading;
--   * `unread` was hardcoded false, when `last_read_at` is the column WhitbyOS
--     keeps the same state in.
--
-- Additive: nothing here drops or edits a policy anyone else owns.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------------
-- The thread row itself.
--
-- `whitbyos_message_threads` has RLS on with only a `_staff` policy, so the
-- portal currently cannot read it at all — reading `subject` needs this. Scoped
-- through the same participation test every other message policy uses, so a
-- client sees exactly the threads they are already a participant of, and the
-- thread's own workspace never widens that.
-- ---------------------------------------------------------------------------
drop policy if exists whitbyos_message_threads_select_client
  on public.whitbyos_message_threads;

create policy whitbyos_message_threads_select_client
  on public.whitbyos_message_threads
  for select using (public.portal_in_thread(id));

-- ---------------------------------------------------------------------------
-- Marking a thread read.
--
-- Deliberately a function rather than an update policy. RLS grants or denies a
-- whole row, so `for update using (participant_id = portal_contact_id())` would
-- let a client write every other column on their own participant row —
-- including `history_visibility` and `added_at`, the two things that decide how
-- far back they may read (SRS 13.6.4), and `removed_at`. That is an escalation,
-- and the column-level grant that would prevent it cannot be used here because
-- staff share the `authenticated` role and need full update on this table.
--
-- So: one security-definer function that writes one column, on the caller's own
-- contact row, and returns nothing.
-- ---------------------------------------------------------------------------
create or replace function public.portal_mark_thread_read(p_thread_id uuid)
returns void language sql volatile security definer set search_path = public as $$
  update public.whitbyos_message_participants
     set last_read_at = now()
   where thread_id = p_thread_id
     and participant_type = 'contact'
     and participant_id = public.portal_contact_id()
     and removed_at is null;
$$;

revoke all on function public.portal_mark_thread_read(uuid) from public, anon;
grant execute on function public.portal_mark_thread_read(uuid) to authenticated;

commit;

-- VERIFY
-- select policyname from pg_policies
--   where tablename = 'whitbyos_message_threads' and policyname like '%_client';
-- select proname from pg_proc where proname = 'portal_mark_thread_read';
