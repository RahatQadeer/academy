-- Portal 017 — a message that is sent by being updated still reaches the client live
--
-- WhitbyOS autosaves a professional's reply as a draft while they type, and
-- sending it flips that same row's status rather than writing a new one
-- (`whitbyos/messages/actions.ts` — "same row, same id, status flipped"). So the
-- event the portal has to receive for a live conversation is very often an
-- UPDATE, not an INSERT.
--
-- Realtime decides what to send a subscriber by replaying the WAL and applying
-- the table's RLS to the record. Under `REPLICA IDENTITY DEFAULT` the WAL's
-- *old* record for an update is only the primary key — every other column is
-- absent — so nothing downstream can tell whether the row was previously
-- visible to that reader, and the one transition that matters here (a draft the
-- client could not read becoming a message they can) is exactly the case that
-- information is needed for. The same gap makes DELETE undecidable for any
-- policy that reads a column other than the id.
--
-- `REPLICA IDENTITY FULL` puts the whole previous row in the WAL and closes it.
--
-- COST. Every update and delete on these two tables writes a second copy of the
-- row to the WAL. These are message rows on a workspace's conversations, not a
-- high-churn ledger, and messages are overwhelmingly inserted once and read
-- many times — the extra WAL is small and bounded, and it buys the feature.
--
-- SAFE TO RUN. `alter table ... replica identity` takes a brief ACCESS EXCLUSIVE
-- lock and rewrites no data. Re-runnable: setting the identity a table already
-- has is a no-op, not an error. No DROP, DELETE or TRUNCATE anywhere.
--
-- Shared with WhitbyOS rather than owned by the portal — both sides subscribe to
-- the same two tables and both are currently missing the same updates.

begin;

alter table public.whitbyos_messages replica identity full;
alter table public.whitbyos_message_threads replica identity full;

commit;

-- VERIFY
-- select relname, relreplident from pg_class
--   where relname in ('whitbyos_messages', 'whitbyos_message_threads');
-- Both should read 'f'. 'd' is the default this file exists to replace.
