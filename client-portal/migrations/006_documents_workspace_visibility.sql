-- Client Portal — let a workspace see the documents a client uploaded onto it.
-- Owner: Rohail (client_portal_*). Sign-off needed: Laiba (base, owns `documents`).
--
-- ADDITIVE. No policy belonging to another module is dropped or modified.
--
-- WHY THIS EXISTS
--
-- A client can already upload a document from the portal (001's
-- `documents_insert_client`) and it lands correctly: a `client_visible` row
-- against their own client or a request they can act on. The professional
-- never sees it.
--
-- base's `documents_select` (00003, narrowed by client-portal/002) reads:
--
--   uploaded_by_user_id = auth.uid()
--   or shared_by_user_id = auth.uid()
--   or (visibility <> 'restricted' and public.shares_workspace_with(uploaded_by_user_id))
--
-- `shares_workspace_with()` walks `workspace_members` for both sides. A client
-- portal login is never a `workspace_members` row — same fact 001's own header
-- explains for `is_workspace_member()` — so when the client is the uploader,
-- every clause is false for every professional in the workspace. The document
-- exists, `documents_select_client` (001) lets the client themselves read it
-- back, but nobody on the WhitbyOS side matches a single clause.
--
-- The existing policy answers "does the caller share a workspace with the
-- uploader"; that question has no right answer when the uploader isn't a
-- workspace member at all. The question that actually matches how Documents
-- are found on the WhitbyOS side (`whitbyos/lib/documents.ts`) is "is this
-- document hung off a Client or Request that belongs to my workspace" — so
-- that's what this policy asks instead, independent of who did the uploading.
--
-- `restricted` is deliberately excluded, matching `documents_select`'s own
-- carve-out (SRS 9.2.4 — restricted is named-people-only, not a workspace-wide
-- grant). A client can never create a `restricted` document in the first place
-- (`documents_insert_client` only allows `client_visible`), so this exclusion
-- costs the client-upload path nothing; it only keeps a professional's own
-- restricted uploads from becoming workspace-wide through this new policy.
--
-- SAFE TO RUN. No DROP, DELETE or TRUNCATE. Postgres OR-combines permissive
-- select policies, so this only adds rows nothing currently returns.

begin;

create policy documents_select_workspace on public.documents
  for select using (
    visibility <> 'restricted'
    and (
      (
        context_type = 'client'
        and exists (
          select 1 from public.whitbyos_clients c
          where c.id = documents.context_id
            and public.is_workspace_member(c.workspace_id)
        )
      )
      or (
        context_type = 'request'
        and exists (
          select 1 from public.whitbyos_requests r
          where r.id = documents.context_id
            and public.is_workspace_member(r.workspace_id)
        )
      )
    )
  );

commit;

-- VERIFY
-- select polname from pg_policies where tablename = 'documents' and policyname = 'documents_select_workspace';
--
-- As a signed-in professional, after a client uploads a document against their
-- own client record from the portal, it should now appear here:
--   select id, title, context_type, context_id from public.documents
--     where context_type = 'client' and context_id = '<that client id>';
