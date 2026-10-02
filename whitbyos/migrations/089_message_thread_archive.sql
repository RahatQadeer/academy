-- =====================================================================
-- Whitby — a conversation can be archived
-- Owner: Sabahat (whitbyos_*)
--
-- Messages had no way to put a finished conversation away. Everything ever
-- said stayed in one list forever, so the rail filled with threads that were
-- over and the ones still moving sank underneath them.
--
-- Archiving is Messages' own, not the workspace Archive: a conversation put
-- away here leaves the rail and is read from the Archived filter beside it,
-- the way a chat client does it. Settings → Archive still owns clients,
-- contacts, requests and the rest, and does not list conversations.
--
-- Nothing is destroyed and nothing is hidden from the client side: an archived
-- thread keeps its messages, its participants and its address, and a contact
-- reading it in the portal sees no difference.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_message_threads
  add column if not exists archived_at timestamptz;

create index if not exists whitbyos_message_threads_archived_idx
  on public.whitbyos_message_threads (workspace_id, archived_at);


-- =====================================================================
-- VERIFY — the column, and how many conversations are put away.
-- =====================================================================
-- select count(*) filter (where archived_at is null) as open,
--        count(*) filter (where archived_at is not null) as archived
-- from public.whitbyos_message_threads;
