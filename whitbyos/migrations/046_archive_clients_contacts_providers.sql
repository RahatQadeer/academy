-- 2.0a, 4.0a and 5.0d — Archive or Delete, for a Client, a Contact and a
-- Provider.
--
-- All three modals offer the same two things, and the first of them is the one
-- the schema could not hold: "Archive this client workspace / contact /
-- provider — hides it from active views. Everything stays intact and you can
-- unarchive anytime from Settings → Archive". Work Plans, Playbooks and
-- Documents have been archivable all along; these three recorded it nowhere,
-- which is why 17.7 names them as kinds that cannot yet be filed away.
--
-- `archived_at`, nullable, the same column and the same meaning the other two
-- tables already use — a timestamp is both the flag and the "when", and 17.7
-- draws the when.
--
-- `contacts` is a base record shared with the Portal and the Partner Center
-- (§5.4). A nullable column nothing else reads is additive: every existing
-- query returns exactly what it returned before.

alter table public.whitbyos_clients
  add column if not exists archived_at timestamptz;

alter table public.contacts
  add column if not exists archived_at timestamptz;

alter table public.whitbyos_providers
  add column if not exists archived_at timestamptz;

create index if not exists whitbyos_clients_archived_idx
  on public.whitbyos_clients (archived_at)
  where archived_at is not null;

create index if not exists contacts_archived_idx
  on public.contacts (archived_at)
  where archived_at is not null;

create index if not exists whitbyos_providers_archived_idx
  on public.whitbyos_providers (archived_at)
  where archived_at is not null;
