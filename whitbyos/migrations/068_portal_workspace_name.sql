-- =====================================================================
-- The professional's workspace name, for the Client Portal.
-- Proposed by: Sabahat (whitbyos). Owner / sign-off: Laiba (base).
--
-- Settings → Workspace writes `workspaces.name`. Letterhead and the
-- professional sidebar already read it live. The portal cannot: 
-- `workspaces_select_member` is `is_workspace_member(id)`, which a contacts
-- row never satisfies. Widening that policy would hand the client the whole
-- professional row.
--
-- Same shape as `portal_workspace_timezone()` (client-portal/008): a definer
-- function returning one text value and nothing else.
--
-- Until this is applied `getPortalContext()` falls back to the client account
-- name, which is what the portal shows today.
--
-- Safe to re-run.
-- =====================================================================

create or replace function public.portal_workspace_name()
returns text language sql stable security definer set search_path = public as $$
  select w.name
  from public.workspaces w
  where w.id in (
    select c.workspace_id
    from public.whitbyos_clients c
    where c.id in (select public.portal_client_ids())
  )
  limit 1;
$$;

revoke all on function public.portal_workspace_name() from public, anon;
grant execute on function public.portal_workspace_name() to authenticated;
