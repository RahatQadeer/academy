-- =====================================================================
-- Whitby — professional / staff RLS policies, remaining 13 tables
-- Owner: Sabahat (whitbyos_*)
--
-- PROPOSED — not requested by Laiba yet, not applied anywhere.
-- File 001 covers the three tables she did ask for. This covers every other
-- whitbyos_* table that has RLS enabled with no policy at all.
--
-- Most of these carry the Workplan spine (SRS §6.4–6.8), so this turns into a
-- blocker as soon as Requests and Workplans are built.
--
-- Same conventions as 001: _staff suffix so the Client Portal can add its own
-- _client policies alongside, access through public.is_workspace_member(), and
-- each policy dropped by its own name first so re-running is harmless.
-- =====================================================================


-- ---- Scoped through Workplan -> Request -------------------------------

drop policy if exists whitbyos_workstreams_staff on public.whitbyos_workstreams;
create policy whitbyos_workstreams_staff on public.whitbyos_workstreams
  for all using (
    exists (
      select 1
      from public.whitbyos_workplans wp
      join public.whitbyos_requests r on r.id = wp.request_id
      where wp.id = workplan_id and public.is_workspace_member(r.workspace_id)
    )
  );

drop policy if exists whitbyos_workplan_versions_staff on public.whitbyos_workplan_versions;
create policy whitbyos_workplan_versions_staff on public.whitbyos_workplan_versions
  for all using (
    exists (
      select 1
      from public.whitbyos_workplans wp
      join public.whitbyos_requests r on r.id = wp.request_id
      where wp.id = workplan_id and public.is_workspace_member(r.workspace_id)
    )
  );

drop policy if exists whitbyos_considerations_staff on public.whitbyos_considerations;
create policy whitbyos_considerations_staff on public.whitbyos_considerations
  for all using (
    exists (
      select 1
      from public.whitbyos_workplans wp
      join public.whitbyos_requests r on r.id = wp.request_id
      where wp.id = workplan_id and public.is_workspace_member(r.workspace_id)
    )
  );


-- ---- Scoped through Workstream -> Workplan -> Request -----------------

drop policy if exists whitbyos_workstream_dependencies_staff on public.whitbyos_workstream_dependencies;
create policy whitbyos_workstream_dependencies_staff on public.whitbyos_workstream_dependencies
  for all using (
    exists (
      select 1
      from public.whitbyos_workstreams ws
      join public.whitbyos_workplans wp on wp.id = ws.workplan_id
      join public.whitbyos_requests r on r.id = wp.request_id
      where ws.id = workstream_id and public.is_workspace_member(r.workspace_id)
    )
  );

drop policy if exists whitbyos_worksheets_staff on public.whitbyos_worksheets;
create policy whitbyos_worksheets_staff on public.whitbyos_worksheets
  for all using (
    exists (
      select 1
      from public.whitbyos_workstreams ws
      join public.whitbyos_workplans wp on wp.id = ws.workplan_id
      join public.whitbyos_requests r on r.id = wp.request_id
      where ws.id = workstream_id and public.is_workspace_member(r.workspace_id)
    )
  );

drop policy if exists whitbyos_checklists_staff on public.whitbyos_checklists;
create policy whitbyos_checklists_staff on public.whitbyos_checklists
  for all using (
    exists (
      select 1
      from public.whitbyos_workstreams ws
      join public.whitbyos_workplans wp on wp.id = ws.workplan_id
      join public.whitbyos_requests r on r.id = wp.request_id
      where ws.id = workstream_id and public.is_workspace_member(r.workspace_id)
    )
  );

drop policy if exists whitbyos_risks_staff on public.whitbyos_risks;
create policy whitbyos_risks_staff on public.whitbyos_risks
  for all using (
    exists (
      select 1
      from public.whitbyos_workstreams ws
      join public.whitbyos_workplans wp on wp.id = ws.workplan_id
      join public.whitbyos_requests r on r.id = wp.request_id
      where ws.id = workstream_id and public.is_workspace_member(r.workspace_id)
    )
  );


-- ---- Scoped through Worksheet -> Workstream -> Workplan -> Request -----

drop policy if exists whitbyos_worksheet_rows_staff on public.whitbyos_worksheet_rows;
create policy whitbyos_worksheet_rows_staff on public.whitbyos_worksheet_rows
  for all using (
    exists (
      select 1
      from public.whitbyos_worksheets sh
      join public.whitbyos_workstreams ws on ws.id = sh.workstream_id
      join public.whitbyos_workplans wp on wp.id = ws.workplan_id
      join public.whitbyos_requests r on r.id = wp.request_id
      where sh.id = worksheet_id and public.is_workspace_member(r.workspace_id)
    )
  );


-- ---- Scoped directly on Request ---------------------------------------

drop policy if exists whitbyos_notes_staff on public.whitbyos_notes;
create policy whitbyos_notes_staff on public.whitbyos_notes
  for all using (
    exists (
      select 1 from public.whitbyos_requests r
      where r.id = request_id and public.is_workspace_member(r.workspace_id)
    )
  );

drop policy if exists whitbyos_decisions_staff on public.whitbyos_decisions;
create policy whitbyos_decisions_staff on public.whitbyos_decisions
  for all using (
    exists (
      select 1 from public.whitbyos_requests r
      where r.id = request_id and public.is_workspace_member(r.workspace_id)
    )
  );

drop policy if exists whitbyos_timeline_events_staff on public.whitbyos_timeline_events;
create policy whitbyos_timeline_events_staff on public.whitbyos_timeline_events
  for all using (
    exists (
      select 1 from public.whitbyos_requests r
      where r.id = request_id and public.is_workspace_member(r.workspace_id)
    )
  );

drop policy if exists whitbyos_provider_options_staff on public.whitbyos_provider_options;
create policy whitbyos_provider_options_staff on public.whitbyos_provider_options
  for all using (
    exists (
      select 1 from public.whitbyos_requests r
      where r.id = request_id and public.is_workspace_member(r.workspace_id)
    )
  );


-- ---- Personal, not workspace-wide -------------------------------------

-- A saved Insight is the professional's own bookmark, so it is scoped to the
-- person who saved it rather than to the whole workspace.
drop policy if exists whitbyos_insight_saves_staff on public.whitbyos_insight_saves;
create policy whitbyos_insight_saves_staff on public.whitbyos_insight_saves
  for all using (saved_by_user_id = auth.uid());


-- =====================================================================
-- VERIFY — returns 0 rows once 001 and 002 are both applied.
-- =====================================================================
-- select c.relname as table_without_policy
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relrowsecurity
--   and c.relname like 'whitbyos%'
--   and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
-- order by 1;
