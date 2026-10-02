-- Workspaces left with nobody in them.
--
-- A professional deleting their account keeps the workspace alive: its clients,
-- Requests, Documents and billing history are the firm's records and several
-- other people may still be working in them. Ownership moves to a colleague and
-- nothing else changes.
--
-- The exception is a solo professional — no team, live clients, open Requests —
-- deleting their only account. Deleting the workspace destroys real client
-- relationships; leaving it running with nobody able to sign in is not viable
-- either. Neither is obviously right, and the code should not pick.
--
-- So it records the situation and stops. A row here means "a person has to look
-- at this", with enough of the moment kept to act on later: which workspace,
-- why, who left, and what was still open when they did.
--
-- Nothing reads this yet. There is no admin console to read it from, and
-- writing the record is the part that must not wait — the moment passes.

create table if not exists public.workspace_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  reason text not null,
  -- Not a foreign key: the account is deleted moments later and this has to
  -- outlive it. Kept as the address, which is what anyone reviewing needs.
  raised_by_email text,
  raised_at timestamptz not null default now(),
  -- What was still live when they left, so the urgency is legible without
  -- reconstructing it from the workspace.
  open_client_count integer,
  open_request_count integer,
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.users (id),
  note text
);

create index if not exists workspace_reviews_open_idx
  on public.workspace_reviews (resolved_at)
  where resolved_at is null;

alter table public.workspace_reviews enable row level security;

-- Deliberately no policy for anyone. These rows are written with the service
-- role at the moment the last member leaves, and read by whatever admin tooling
-- exists later — never by a workspace member, since by definition there are
-- none left to read them.
