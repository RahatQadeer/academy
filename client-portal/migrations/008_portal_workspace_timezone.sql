-- =====================================================================
-- The zone the portal draws a date in.
-- Proposed by: Rohail (client-portal). Owner / sign-off: Laiba (base).
--
-- `whitbyos/033`–`034` connected Google Calendar, and `whitbyos/lib/zoned.ts`
-- moved every date decision on the professional's Calendar into
-- `workspaces.timezone` — the zone the professional actually works in. The
-- portal renders the same rows and had no way to reach that column, so it
-- formatted everything in UTC. A 9:00 AM appointment booked in New York was
-- shown to the client as 1:00 PM, and an evening one on the wrong day.
--
-- Reading it needs `workspaces`, and a client matches nothing there:
-- `workspaces_select_member` is `is_workspace_member(id)`, which a contacts
-- row can never satisfy. Widening that policy is the wrong fix — it grants the
-- whole row, and `workspaces` carries the professional's own settings.
--
-- So: a definer function returning one text value and nothing else, the same
-- shape `portal_thread_people()` uses to hand out display names without
-- handing out `contacts`.
--
-- Until this is applied `getPortalContext()` falls back to 'UTC', which is
-- exactly what the portal does today — so nothing regresses while it waits.
--
-- Safe to re-run.
-- =====================================================================

create or replace function public.portal_workspace_timezone()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(w.timezone, ''), 'UTC')
  from public.workspaces w
  where w.id in (
    select c.workspace_id
    from public.whitbyos_clients c
    where c.id in (select public.portal_client_ids())
  )
  limit 1;
$$;

revoke all on function public.portal_workspace_timezone() from public, anon;
grant execute on function public.portal_workspace_timezone() to authenticated;


-- =====================================================================
-- VERIFY — signed in as a client, should return their professional's zone
-- (or 'UTC' where the workspace has none set). Signed in as anyone else,
-- null.
-- =====================================================================
-- select public.portal_workspace_timezone();
