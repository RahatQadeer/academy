-- =====================================================================
-- Portal seat limits move from the client membership to the workspace.
--
-- `whitbyos_client_members.max_additional_members` (00004) was set per client
-- by the professional, on the Account tab's "Set limits" dialog. Two problems
-- with that: the number is a commercial decision Private Attaché makes, not
-- one the professional makes about their own client; and because the portal
-- reads the ceiling off the row of whoever signs in, every new membership had
-- to copy the account's numbers forward or that person saw no limit at all.
--
-- Both columns now live on `workspaces`, set by Super Admin. One row decides
-- for every client in the workspace, so nothing has to be copied and nothing
-- can drift between two members of the same account.
--
-- `max_additional_members` is NOT NULL with a default of 10: every workspace
-- has a number, and 10 is the plan baseline. `max_authorized_users` stays
-- nullable, where NULL means no limit — the value every account carries today,
-- so removing the professional's editor does not quietly impose a ceiling
-- nobody chose.
--
-- The old columns are left in place, unread, rather than dropped: the approval
-- path in `whitbyos/clients/actions.ts` wrote them on every insert, and a drop
-- would take the history with it. Nothing reads them after this.
--
-- Safe to re-run.
-- =====================================================================

alter table public.workspaces
  add column if not exists max_additional_members integer not null default 10;

alter table public.workspaces
  add column if not exists max_authorized_users integer;

-- A whole number, or nothing. 999 is the same bound the old dialog enforced.
alter table public.workspaces
  drop constraint if exists workspaces_max_additional_members_range;
alter table public.workspaces
  add constraint workspaces_max_additional_members_range
  check (max_additional_members >= 0 and max_additional_members <= 999);

alter table public.workspaces
  drop constraint if exists workspaces_max_authorized_users_range;
alter table public.workspaces
  add constraint workspaces_max_authorized_users_range
  check (max_authorized_users is null
         or (max_authorized_users >= 0 and max_authorized_users <= 999));

comment on column public.workspaces.max_additional_members is
  'Additional Members each client account in this workspace may hold. Set by Super Admin only.';
comment on column public.workspaces.max_authorized_users is
  'Authorized Users each client account may hold. NULL is no limit. Set by Super Admin only.';

-- =====================================================================
-- Carry forward what was already decided.
--
-- A workspace whose clients were held to a number keeps that number where it
-- is *higher* than the new baseline; where it was lower (the seeded 4) the
-- baseline wins, because raising every client to 10 is the point of this
-- change. Runs once — a second run finds 10 already there and the greatest()
-- is a no-op.
-- =====================================================================
update public.workspaces w
   set max_additional_members = greatest(10, prior.held)
  from (
    select c.workspace_id, max(m.max_additional_members) as held
      from public.whitbyos_client_members m
      join public.whitbyos_clients c on c.id = m.client_id
     where m.max_additional_members is not null
     group by c.workspace_id
  ) prior
 where prior.workspace_id = w.id
   and w.max_additional_members = 10
   and prior.held > 10;

update public.workspaces w
   set max_authorized_users = prior.held
  from (
    select c.workspace_id, max(m.max_authorized_users) as held
      from public.whitbyos_client_members m
      join public.whitbyos_clients c on c.id = m.client_id
     where m.max_authorized_users is not null
     group by c.workspace_id
  ) prior
 where prior.workspace_id = w.id
   and w.max_authorized_users is null;

-- =====================================================================
-- Super Admin only, enforced here rather than by the absence of a button.
--
-- `workspaces_update_member` (00003) is `for update using (is_workspace_member(id))`,
-- so every professional in the workspace may write this row — that is how they
-- set their own name, logo and timezone. Removing the "Set limits" dialog takes
-- away the way in, not the permission. RLS has no column-level form, so the two
-- seat columns are pinned by a trigger instead: Super Admin writes them on the
-- service role, which bypasses this check, and any other caller leaving them
-- alone never trips it.
-- =====================================================================
create or replace function public.workspaces_seat_limits_are_staff_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.max_additional_members is distinct from old.max_additional_members
     or new.max_authorized_users is distinct from old.max_authorized_users then
    -- `auth.role()` is the JWT's role claim; the service key carries
    -- 'service_role'. A direct SQL session has no JWT, so fall back to the
    -- connected user, which is how this stays runnable from the SQL editor.
    if coalesce(nullif(auth.role(), ''), current_user) not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'Portal seat limits are set by Private Attache staff, not from the workspace.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_seat_limits_guard on public.workspaces;
create trigger workspaces_seat_limits_guard
  before update on public.workspaces
  for each row execute function public.workspaces_seat_limits_are_staff_only();


-- =====================================================================
-- VERIFY
-- =====================================================================
-- select id, name, max_additional_members, max_authorized_users
--   from public.workspaces order by name;
