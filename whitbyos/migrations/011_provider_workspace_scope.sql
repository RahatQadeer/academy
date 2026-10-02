-- =====================================================================
-- Whitby — Providers belong to a workspace
-- Owner: Sabahat (whitbyos_*)
--
-- SECURITY. `whitbyos_providers` carries no workspace of its own, and its
-- policy in base's 00004 is:
--
--     create policy whitbyos_providers_select on public.whitbyos_providers
--       for all using (auth.uid() is not null)
--       with check (auth.uid() is not null);
--
-- That is every signed-in user in the system, reading and writing every
-- provider record in it. A professional in one workspace can list, edit and
-- delete another professional's provider directory — who they source from,
-- what they pay, what they wrote about them. Every other whitbyos_* table is
-- scoped through `is_workspace_member`; this one was missed.
--
-- The column has to come first, because there is nothing to scope by. Existing
-- rows inherit the workspace of whoever created the company or contact behind
-- them, which is the only workspace they could ever have belonged to.
--
-- Rows that inherit nothing — a provider whose company and contact were both
-- created outside any workspace — are left null and become invisible rather
-- than visible to everyone. That is the safe direction for a mistake.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_providers
  add column if not exists workspace_id uuid
    references public.workspaces (id) on delete cascade;

update public.whitbyos_providers p
set workspace_id = coalesce(
      (select c.created_by_workspace_id from public.companies c where c.id = p.company_id),
      (select ct.created_by_workspace_id from public.contacts ct where ct.id = p.contact_id)
    )
where p.workspace_id is null;

create index if not exists whitbyos_providers_workspace_id_idx
  on public.whitbyos_providers (workspace_id);

-- ---- The policy this table should always have had --------------------

drop policy if exists whitbyos_providers_select on public.whitbyos_providers;
drop policy if exists whitbyos_providers_staff on public.whitbyos_providers;

create policy whitbyos_providers_staff on public.whitbyos_providers
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- `whitbyos_provider_options` reaches its workspace through its Request, so it
-- already scopes correctly and is left alone.


-- =====================================================================
-- VERIFY — the policy should read is_workspace_member, not auth.uid()
-- =====================================================================
-- select polname, pg_get_expr(polqual, polrelid) as using_expr
-- from pg_policy
-- where polrelid = 'public.whitbyos_providers'::regclass;
