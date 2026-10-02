-- =====================================================================
-- Base policy fixes — three policies that are wider than they read.
-- Proposed by: Rohail (client-portal). Owner / sign-off: Laiba (base).
--
-- SEPARATE FROM 001 ON PURPOSE. 001 is additive and touches nobody else's
-- policies. This file is the only one that drops base-owned policies, so it
-- can be reviewed, approved, or rejected on its own without blocking 001.
--
-- All three affect ZERO ROWS today — `documents` and `document_labels` are
-- both empty — which makes now the cheapest possible moment to fix them.
--
-- Apply AFTER 001: the replacement documents_select below removes the blanket
-- client_portal clause, and 001's documents_select_client is what restores
-- properly scoped portal access in its place.
-- =====================================================================


-- SECURITY FIX (base-owned policy, Laiba to confirm).
-- The original `documents_select` granted every client_portal-entitled user read
-- access to every `client_visible` document in the system, regardless of which
-- client it belonged to — a cross-client leak. Replaced with the same policy
-- minus that clause; portal access is granted specifically by the policy below.
-- Zero rows are affected: the documents table is empty.
begin;

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select using (
    uploaded_by_user_id = auth.uid()
    or shared_by_user_id = auth.uid()
    or (
      visibility <> 'restricted'
      and public.shares_workspace_with(uploaded_by_user_id)
    )
  );


-- SECURITY FIX (base-owned policy, Laiba to confirm).
-- `document_labels_all` read `using (created_by_user_id = auth.uid() or auth.uid()
-- is not null)` — the second clause makes it true for every authenticated user,
-- so labels on any document were world-readable. Scoped to documents the caller
-- can actually see. Zero rows affected.
drop policy if exists document_labels_all on public.document_labels;
create policy document_labels_select on public.document_labels
  for select using (
    exists (select 1 from public.documents d where d.id = document_id)
  );
create policy document_labels_insert on public.document_labels
  for insert with check (
    created_by_user_id = auth.uid()
    and exists (select 1 from public.documents d where d.id = document_id)
  );
create policy document_labels_delete on public.document_labels
  for delete using (created_by_user_id = auth.uid());

commit;
