-- Client-visible Tasks on a Request.
-- Owner: Rohail (client_portal_*). Sign-off needed: Sabahat (whitbyos_*).
--
-- ADDITIVE ONLY. No policy belonging to another module is dropped or modified.
--
-- WHY THIS EXISTS
--
-- `whitbyos_tasks` has RLS enabled with exactly one policy, `whitbyos_tasks_all`
-- (00004_whitbyos_schema.sql), scoped to `is_workspace_member(workspace_id)`. A
-- client is never a workspace member, so a Client Portal login matches zero
-- rows — a professional can mark a Task `visibility = 'client_visible'` and
-- attach it to a Request the client can already see, and the client still gets
-- nothing back. Nothing in `client-portal/` reads this table today either; this
-- migration is the database half of the fix, `lib/data/tasks.ts` the app half.
--
-- This is exactly the gap SRS 7.1.5 anticipates: "client-assigned and
-- client-visible Tasks remain separately and independently permissioned" from
-- Team Tasks. `whitbyos_tasks.visibility` already carries the same
-- `visibility_level` enum (`internal` default, `client_visible`, `restricted`)
-- that gates every other client-facing surface in this schema — Documents,
-- Updates, Calendar. Nothing new is added to the schema; this is the missing
-- read path for a column that has existed since `00004_whitbyos_schema.sql`.
--
-- SRS 13.2.3 / 13.3.4: Tasks is deliberately not a main-navigation item — client
-- tasks surface through Home -> Action Needed. That is a UI decision the portal
-- code enforces (`nav.ts`, `lib/data/home.ts`); it has no bearing on whether the
-- underlying row is readable. A client-visible Task on a Request the client can
-- see must be readable the same way a client-visible Document on that Request
-- already is.
--
-- SCOPED TWO WAYS, since whitbyos/044.
--
-- This file used to be scoped to a Task's Request alone, and said so: at the
-- time `whitbyos_tasks` had no `client_id` of its own, so a Task with no
-- `request_id` had no client-facing surface to appear on and stayed invisible
-- regardless of `visibility`.
--
-- `whitbyos/migrations/044_task_client_and_assignees.sql` ends that. 16z's New
-- Task modal asks for a "Client / Workspace" directly, precisely so a Task can
-- belong to a client without belonging to a Request — the reference has a
-- "General" view for exactly those. A client-visible Task named to this client
-- and to no Request is a Task the professional deliberately pointed at them,
-- and the old policy would have hidden it.
--
-- So the test is now either route. `portal_is_client_of()` already returns
-- false for a null argument and `portal_can_see_request()` matches nothing on
-- one, so a Task with neither is still invisible — which is right, it belongs
-- to nobody.
--
-- The policy is widened here rather than replaced by a later migration.
-- Nothing in the database changes shape.
--
-- RE-RUNNABLE, and it has to be.
--
-- This file used to say it had never been applied, and that was wrong: running
-- it raises `42710: policy "whitbyos_tasks_select_client" ... already exists`,
-- which is what an applied policy looks like. The `create policy` had no drop
-- in front of it, so the file could not be run a second time to find out *which*
-- version was applied.
--
-- That is the part that mattered. The first version of this file scoped to the
-- Request route alone -- `visibility = client_visible and
-- portal_can_see_request(request_id)` -- and a database still carrying it hides
-- every Task named straight to a client with no Request, which is precisely
-- what `/client-portal/tasks` was built to show. The two states are
-- indistinguishable from the error, and the same error blocked the one command
-- that would have settled it.
--
-- So the policy is dropped by its own name first, the way `002`, `003`, `004`,
-- `007` and the rest of this folder guard their statements. Running this file
-- now installs the current definition whatever was there before, and running it
-- twice is harmless.
--
-- SAFE TO RUN. No DROP TABLE, DROP COLUMN, DELETE, or TRUNCATE. The one drop is
-- of this module's own policy, by name, and it is recreated two lines later
-- inside the same transaction: Postgres DDL is transactional, so a failure
-- rolls the whole file back and the database is untouched.

begin;

-- By its own name, and only its own: nothing belonging to another module is
-- touched. This is what makes the file re-runnable, and what replaces a
-- Request-only version left over from the first cut of it.
drop policy if exists whitbyos_tasks_select_client on public.whitbyos_tasks;

-- `portal_can_see_request()` already applies SRS 13.14.14 (client_account vs.
-- selected_people vs. private_to_requestor) — reused rather than duplicated, the
-- same function every other Request-scoped client policy in `001` calls.
create policy whitbyos_tasks_select_client on public.whitbyos_tasks
  for select using (
    visibility = 'client_visible'
    and (
      public.portal_can_see_request(request_id)
      or public.portal_is_client_of(client_id)
    )
  );

commit;

-- VERIFY
--
-- Which version is installed, which is the question the "already exists" error
-- could not answer. `qual` should mention BOTH portal_can_see_request and
-- portal_is_client_of; only the first means the Request-only version is still
-- in place and Tasks named straight to a client are still hidden.
--
-- select policyname, qual from pg_policies
--   where tablename = 'whitbyos_tasks' and policyname = 'whitbyos_tasks_select_client';
--
-- As a signed-in client, should return only client_visible Tasks either on a
-- Request they are permitted to see or named to their own client account:
--   select id, title, visibility, request_id, client_id from public.whitbyos_tasks;
