-- =====================================================================
-- How many people this client's account may hold.
-- Proposed by: Rohail (client-portal). Owner / sign-off: Laiba (base).
--
-- `supabase/migrations/00056` moved both seat ceilings off
-- `whitbyos_client_members` and onto `workspaces`, where Super Admin sets one
-- number for every client in the workspace. The portal counts People & Access
-- against that number and has to be able to read it.
--
-- It cannot read it directly, for exactly the reason `008` gave for the
-- timezone: `workspaces_select_member` is `is_workspace_member(id)`, which a
-- contact can never satisfy, and widening it would hand the client the
-- professional's whole settings row. So: a definer function returning the two
-- numbers and nothing else.
--
-- Returned as a single row rather than two scalars so the portal spends one
-- round trip on a value it needs on every request.
--
-- Until this is applied `getPortalContext()` falls back to the same baseline
-- the column defaults to, so nothing regresses while it waits.
--
-- Safe to re-run.
-- =====================================================================

drop function if exists public.portal_workspace_seat_limits();

create function public.portal_workspace_seat_limits()
returns table (max_additional_members integer, max_authorized_users integer)
language sql stable security definer set search_path = public as $$
  select w.max_additional_members, w.max_authorized_users
  from public.workspaces w
  where w.id in (
    select c.workspace_id
    from public.whitbyos_clients c
    where c.id in (select public.portal_client_ids())
  )
  limit 1;
$$;

revoke all on function public.portal_workspace_seat_limits() from public, anon;
grant execute on function public.portal_workspace_seat_limits() to authenticated;


-- =====================================================================
-- VERIFY — signed in as a client, one row with their workspace's numbers.
-- Signed in as anyone else, no rows.
-- =====================================================================
-- select * from public.portal_workspace_seat_limits();
