-- =====================================================================
-- Whitby — professional / staff RLS policies
-- Owner: Sabahat (whitbyos_*)
-- Scope: the three tables Laiba asked for. Client Portal side is Rohail's.
--
-- Each policy grants access to active members of the workspace that owns the
-- row's parent, reusing public.is_workspace_member() — the same helper the
-- already-working whitbyos tables use.
--
-- NAMING: every policy is suffixed _staff. Postgres combines multiple
-- policies on a table with OR, so Rohail can later add a matching _client
-- policy to the same table and both apply. Nothing here needs to be dropped
-- or edited when he does.
--
-- NOT TOUCHED: no existing policy is dropped or modified. The three DROP
-- statements below name only the _staff policies created in this file, so
-- re-running is safe and nothing pre-existing is affected.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. whitbyos_updates
--    Progress Updates and Plans & Updates (SRS §6.15, §7.6).
--    Scoped by Client: request_id is nullable here, because a Plans &
--    Updates entry belongs to the Client without belonging to any Request.
--    client_id is NOT NULL, so it is the reliable path to the workspace.
-- ---------------------------------------------------------------------

drop policy if exists whitbyos_updates_staff on public.whitbyos_updates;
create policy whitbyos_updates_staff on public.whitbyos_updates
  for all using (
    exists (
      select 1
      from public.whitbyos_clients c
      where c.id = client_id
        and public.is_workspace_member(c.workspace_id)
    )
  );


-- ---------------------------------------------------------------------
-- 2. whitbyos_form_submissions
--    Scoped through the parent Form, which carries workspace_id directly.
--    request_id and client_id are both nullable on a submission, so the
--    form is the only dependable route to a workspace.
-- ---------------------------------------------------------------------

drop policy if exists whitbyos_form_submissions_staff on public.whitbyos_form_submissions;
create policy whitbyos_form_submissions_staff on public.whitbyos_form_submissions
  for all using (
    exists (
      select 1
      from public.whitbyos_forms f
      where f.id = form_id
        and public.is_workspace_member(f.workspace_id)
    )
  );


-- ---------------------------------------------------------------------
-- 3. whitbyos_message_participants
--    thread_id is a plain uuid, not a foreign key, so this matches back
--    through the messages sharing that thread.
--
--    Both tables have a column named thread_id, so the outer one is written
--    out in full — without that the comparison is ambiguous.
--
--    Note this governs who may READ the participant list. It does not by
--    itself decide who may join a thread; SRS §5.6.3 keeps conversation
--    access narrower than Request access, enforced in the app layer.
-- ---------------------------------------------------------------------

drop policy if exists whitbyos_message_participants_staff on public.whitbyos_message_participants;
create policy whitbyos_message_participants_staff on public.whitbyos_message_participants
  for all using (
    exists (
      select 1
      from public.whitbyos_messages m
      where m.thread_id = whitbyos_message_participants.thread_id
        and public.is_workspace_member(m.workspace_id)
    )
  );


-- =====================================================================
-- VERIFY — run this after the above. All three rows should appear.
-- =====================================================================
-- select c.relname as table_name, p.polname as policy_name
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- left join pg_policy p on p.polrelid = c.oid
-- where n.nspname = 'public'
--   and c.relname in (
--     'whitbyos_updates',
--     'whitbyos_form_submissions',
--     'whitbyos_message_participants'
--   )
-- order by 1, 2;
