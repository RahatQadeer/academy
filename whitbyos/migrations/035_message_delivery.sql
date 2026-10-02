-- =====================================================================
-- Whitby — the middle tick
-- Owner: Sabahat (whitbyos_*)
--
-- A message can currently say two things: Whitby has it, and everyone else
-- has opened the thread. The tick between those — delivered, meaning it
-- reached the other person's screen but they have not read it — is the one
-- nothing can answer, because nothing writes anything down when it arrives.
--
-- `whitbyos_message_participants.last_read_at` records opening a thread, which
-- is reading. Delivery is a different moment and belongs on the message: it is
-- per message, not per thread, and it happens whether or not anyone looks.
--
-- Written by the recipient's own browser, the first time Realtime hands it a
-- message it has not seen before. That is why it is nullable with no default —
-- a message that has never reached anyone must stay null rather than claiming
-- the moment it was inserted.
--
-- Only ever set once, and only forwards: `coalesce(delivered_at, now())` at the
-- write site, so a later client cannot move an earlier delivery.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_messages
  add column if not exists delivered_at timestamptz;

-- The ticks are drawn per thread, newest first, which is how they are read.
create index if not exists whitbyos_messages_thread_delivery_idx
  on public.whitbyos_messages (thread_id, created_at desc)
  where status = 'sent';


-- =====================================================================
-- VERIFY — should return one row.
-- =====================================================================
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_messages'
--   and column_name = 'delivered_at';
