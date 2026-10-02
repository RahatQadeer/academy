-- Playbooks v2 — Archive/Delete, the same settlement Work Plans reached.
--
-- The reference replaced the 🗑 on each row with the words "Archive/Delete",
-- and the dialog behind it now offers "Archive this Playbook" and "Delete
-- permanently". The client's rule has not changed: nothing leaves the database.
-- So both columns are marks, exactly as migration 038 did for Work Plans -
-- archiving hides a Playbook from the library and Settings → Archive brings it
-- back, deleting hides it from everywhere and does not.
--
-- Neither touches a Work Plan built from this Playbook. Those carry their own
-- copy of the content, and `source_playbook_id` is a record of where they came
-- from, not a dependency on it - which is why the dialog can promise that Work
-- Plans already created from it are unaffected, and mean it.

alter table public.whitbyos_playbooks
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid references auth.users(id),
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references auth.users(id);

-- The library reads "everything still standing in this workspace", which is
-- now a three-column test rather than one.
create index if not exists whitbyos_playbooks_live_idx
  on public.whitbyos_playbooks (workspace_id, updated_at desc)
  where archived_at is null and deleted_at is null;

-- Settings 17.7 reads the other side of it.
create index if not exists whitbyos_playbooks_archived_idx
  on public.whitbyos_playbooks (workspace_id, archived_at desc)
  where archived_at is not null and deleted_at is null;

-- Who made it, so the same "only its owner" rule the client set for Work Plans
-- can hold here. Nothing is backfilled: the rows that predate this column have
-- no author on record, and inventing one would be worse than the code's own
-- fallback, which is to let anyone in the workspace act on an unattributed
-- Playbook.
alter table public.whitbyos_playbooks
  add column if not exists created_by_user_id uuid references auth.users(id);
