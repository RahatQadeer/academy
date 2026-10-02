-- 055 — a Note that does not belong to a Request.
--
-- Screen 1.2c takes a note from Quick Add with the Request optional and a
-- Client Workspace optional beside it. whitbyos_notes could not hold that: it
-- required a request_id, had no client and no workspace, and its RLS policy
-- reached rows only through the Request they hung off. A note with neither
-- would have been unreachable by the person who had just written it.
--
-- The policy is replaced rather than added to. One policy that names all three
-- routes is easier to reason about than three that OR together, and the
-- workspace column is the one every other Whitby table already uses.

alter table public.whitbyos_notes
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists client_id uuid references public.whitbyos_clients(id) on delete set null;

alter table public.whitbyos_notes alter column request_id drop not null;

-- Notes written before this migration have a Request, so their workspace is
-- the Request's. Nothing is left without one.
update public.whitbyos_notes n
set workspace_id = r.workspace_id
from public.whitbyos_requests r
where r.id = n.request_id and n.workspace_id is null;

create index if not exists whitbyos_notes_workspace_idx on public.whitbyos_notes (workspace_id);
create index if not exists whitbyos_notes_client_idx on public.whitbyos_notes (client_id);

drop policy if exists whitbyos_notes_staff on public.whitbyos_notes;

create policy whitbyos_notes_staff on public.whitbyos_notes
  for all
  using (
    public.is_workspace_member(workspace_id)
    or exists (
      select 1 from public.whitbyos_requests r
      where r.id = whitbyos_notes.request_id
        and public.is_workspace_member(r.workspace_id)
    )
  )
  with check (
    public.is_workspace_member(workspace_id)
    or exists (
      select 1 from public.whitbyos_requests r
      where r.id = whitbyos_notes.request_id
        and public.is_workspace_member(r.workspace_id)
    )
  );
