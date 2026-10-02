-- 6.1's Version History panel.
--
-- The detail screen lists "v4 — Added Household Staffing · 2w ago" down to
-- "v1 — Created by Jordan Hartwell · 11mo ago". `whitbyos_playbooks.version`
-- holds only the number, so the panel had nothing to draw and was left off the
-- screen entirely. This is the table it needs, shaped like the one Work Plans
-- already keep in whitbyos_workplan_versions: the whole contents at that
-- version, and why it changed.
--
-- The snapshot rather than a diff, for the same reason as over there — a
-- Playbook is small, and a version you can read back whole is worth more than
-- one you have to reconstruct.

create table if not exists public.whitbyos_playbook_versions (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.whitbyos_playbooks(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  change_reason text,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (playbook_id, version_number)
);

create index if not exists whitbyos_playbook_versions_playbook_idx
  on public.whitbyos_playbook_versions (playbook_id, version_number desc);

alter table public.whitbyos_playbook_versions enable row level security;

-- Named _staff so the Client Portal can add its own _client policy later
-- without either side editing the other's, which is this schema's convention.
drop policy if exists whitbyos_playbook_versions_staff on public.whitbyos_playbook_versions;
create policy whitbyos_playbook_versions_staff
  on public.whitbyos_playbook_versions
  for all
  using (
    exists (
      select 1
      from public.whitbyos_playbooks p
      where p.id = whitbyos_playbook_versions.playbook_id
        and is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.whitbyos_playbooks p
      where p.id = whitbyos_playbook_versions.playbook_id
        and is_workspace_member(p.workspace_id)
    )
  );
