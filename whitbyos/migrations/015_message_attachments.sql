-- Attachments on a message.
--
-- The export's composer is one line and a Send button, with nothing to attach
-- with. But §6.11.1 keeps "original source links" on a Request's Messages area,
-- and in practice a document travels over a message before it is ever a managed
-- Document — so the paperclip is a real gap in the reference rather than a
-- feature invented here.
--
-- These are deliberately NOT rows in `documents`. A managed Document has a
-- status, a visibility, an effective date and a place in a client's file
-- (§14.x); a file dropped into a conversation has none of that until someone
-- decides it should. Keeping them apart means attaching a file never quietly
-- creates a half-filled Document, and promoting one later stays an explicit act.
--
-- Files live in the existing `documents` storage bucket, which is private and
-- reachable only through a signed URL (00009_storage.sql).

create table if not exists public.whitbyos_message_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  message_id uuid not null references public.whitbyos_messages (id) on delete cascade,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  -- Path inside the `documents` bucket, never a public URL.
  storage_path text not null,
  uploaded_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

create index if not exists whitbyos_message_attachments_message_idx
  on public.whitbyos_message_attachments (message_id);

alter table public.whitbyos_message_attachments enable row level security;

drop policy if exists whitbyos_message_attachments_workspace
  on public.whitbyos_message_attachments;

create policy whitbyos_message_attachments_workspace
  on public.whitbyos_message_attachments
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- A draft is one row per person per thread, not a pile of them. Autosave writes
-- while someone types, so without this a single unsent reply would leave a new
-- row behind on every keystroke pause.
create unique index if not exists whitbyos_messages_one_draft_per_sender
  on public.whitbyos_messages (thread_id, sender_id)
  where status = 'draft';
