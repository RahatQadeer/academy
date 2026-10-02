-- 6.0a–6.0d — the New Playbook wizard needs somewhere to stand between steps.
--
-- The reference walks four steps, and step 3 is a real editor: Work Streams
-- are added, renamed and removed, tasks typed under them, and Ask Whitby can
-- draft the lot from a description. None of that fits in a query string, so
-- the row is created when step 2 is answered and edited in place from there.
--
-- Which means the library has to be able to tell a Playbook somebody is still
-- writing from one they finished. `is_draft` is that, and it is false by
-- default so every Playbook that already exists stays exactly as it is.
--
-- Nothing sweeps abandoned drafts. Sabahat asked for the opposite on the Work
-- Plans wizard - walking away from one halfway should leave a draft, not lose
-- the typing - and the same answer holds here.

alter table public.whitbyos_playbooks
  add column if not exists is_draft boolean not null default false;

-- The library's read is now "in this workspace, still standing, and finished".
drop index if exists whitbyos_playbooks_live_idx;
create index if not exists whitbyos_playbooks_live_idx
  on public.whitbyos_playbooks (workspace_id, updated_at desc)
  where archived_at is null and deleted_at is null and is_draft = false;
