-- 13.3 — Archive or Delete an article, and the last kind 17.7 could not hold.
--
-- Migration 046 gave clients, contacts and providers an `archived_at` and left
-- Knowledge Articles as the one entry still listed on the Archive tab as a kind
-- nothing could archive. 13.3 is the screen that was missing on the other side
-- of it: "Archive this article — hidden from the Library but recoverable
-- later", beside a delete that says it is for good.
--
-- Same column and same meaning as the other five, so 17.7 reads them all the
-- same way and Restore does one thing rather than six.

alter table public.whitbyos_knowledge
  add column if not exists archived_at timestamptz;

create index if not exists whitbyos_knowledge_archived_idx
  on public.whitbyos_knowledge (archived_at)
  where archived_at is not null;
