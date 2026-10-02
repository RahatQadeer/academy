-- Provisions one working Client Portal login for testing.
--
-- NOT a schema migration and NOT auto-run: this lives in
-- `client-portal/migrations/` and is unnumbered, so `supabase db reset` never
-- picks it up. Run it by hand.
--
-- REQUIRES 001_client_identity_and_rls.sql (creates client_portal_identities
-- and the portal_* resolvers). Running this first fails on step 6.
--
-- Idempotent: re-running updates the same rows rather than duplicating them.
--
-- ---------------------------------------------------------------------------
-- TWO DIFFERENT PEOPLE, ON PURPOSE
--
--   PROFESSIONAL  rohailahmed303@gmail.com  — owns the workspace and the client
--                 record, and is a workspace member so Whitby's screens work.
--   CLIENT        rohail12@yopmail.com      — the portal login. Deliberately NOT
--                 a workspace member.
--
-- That separation is the whole point. If the portal login were also a member of
-- the workspace serving it, is_workspace_member() would return true and the
-- session would sail through the _staff policies — the portal would look like it
-- works while never exercising a single client-side policy. Keep these two
-- accounts distinct or the test proves nothing.
--
-- Both accounts must have signed in at least once so base has created their
-- public.users row.
-- ---------------------------------------------------------------------------

do $$
declare
  v_pro_email    text := 'rohailahmed303@gmail.com';
  v_client_email text := 'rohail12@yopmail.com';
  v_client_name  text := 'Ahmed Family Office';

  v_pro_id       uuid;
  v_user_id      uuid;
  v_full_name    text;
  v_first        text;
  v_last         text;
  v_workspace    uuid;
  v_contact      uuid;
  v_client       uuid;
begin
  ------------------------------------------------------------------
  -- 0. Both people must already exist in public.users.
  ------------------------------------------------------------------
  select id into v_pro_id
  from public.users where lower(email) = lower(v_pro_email);

  if v_pro_id is null then
    raise exception
      'No public.users row for the professional (%). Sign in once first.', v_pro_email;
  end if;

  select id, coalesce(nullif(btrim(full_name), ''), split_part(email, '@', 1))
    into v_user_id, v_full_name
  from public.users where lower(email) = lower(v_client_email);

  if v_user_id is null then
    raise exception
      'No public.users row for the client (%). Sign in once first.', v_client_email;
  end if;

  if v_pro_id = v_user_id then
    raise exception
      'The professional and the client must be different accounts, otherwise the client-side policies are never exercised.';
  end if;

  v_first := split_part(v_full_name, ' ', 1);
  v_last  := nullif(btrim(substr(v_full_name, length(v_first) + 1)), '');

  ------------------------------------------------------------------
  -- 1. The professional's workspace, owned by the professional.
  ------------------------------------------------------------------
  select id into v_workspace
  from public.workspaces where url_slug = 'portal-test-workspace';

  if v_workspace is null then
    insert into public.workspaces (name, url_slug, owner_user_id, timezone)
    values ('Portal Test Workspace', 'portal-test-workspace', v_pro_id, 'UTC')
    returning id into v_workspace;
  else
    update public.workspaces
       set owner_user_id = v_pro_id, updated_at = now()
     where id = v_workspace;
  end if;

  -- The professional IS a member — this is what makes Whitby's Clients screen
  -- show the record. The client is deliberately never added here.
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = v_workspace and user_id = v_pro_id
  ) then
    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (v_workspace, v_pro_id, 'owner', 'active');
  end if;

  ------------------------------------------------------------------
  -- 2. The client's canonical person record. Base owns `contacts`.
  ------------------------------------------------------------------
  select id into v_contact
  from public.contacts where lower(email) = lower(v_client_email);

  if v_contact is null then
    insert into public.contacts
      (first_name, last_name, email, source, created_by_workspace_id)
    values
      (v_first, coalesce(v_last, ''), v_client_email, 'client_portal_seed', v_workspace)
    returning id into v_contact;
  end if;

  ------------------------------------------------------------------
  -- 3. The client account. `preferences` carries the capability ceiling the
  --    professional sets — SRS 13.14.5 to 13.14.7. The portal reads these and
  --    can never offer a capability set false here.
  ------------------------------------------------------------------
  select id into v_client
  from public.whitbyos_clients
  where workspace_id = v_workspace and name = v_client_name;

  if v_client is null then
    insert into public.whitbyos_clients
      (workspace_id, name, client_type, status, owner_user_id, primary_contact_id, preferences)
    values
      (v_workspace, v_client_name, 'family', 'active', v_pro_id, v_contact,
       jsonb_build_object(
         'may_request_access',      true,
         'may_invite_directly',     false,
         'may_add_to_request',      true,
         'may_add_to_conversation', true
       ))
    returning id into v_client;
  else
    update public.whitbyos_clients
       set primary_contact_id = v_contact,
           owner_user_id      = v_pro_id,
           updated_at         = now()
     where id = v_client;
  end if;

  ------------------------------------------------------------------
  -- 4. Membership. portal_access = true is what portal_client_ids() keys on;
  --    without it every read returns empty even with 001 applied.
  --
  --    The seat ceilings used to be written here, 4 and 2. They live on the
  --    workspace now (supabase/00056) and are set in Super Admin, so this
  --    seeds the workspace's numbers below instead of the membership's.
  ------------------------------------------------------------------
  if not exists (
    select 1 from public.whitbyos_client_members
    where client_id = v_client and contact_id = v_contact
  ) then
    insert into public.whitbyos_client_members
      (client_id, contact_id, role, portal_access)
    values
      (v_client, v_contact, 'primary_member', true);
  else
    update public.whitbyos_client_members
       set portal_access = true, role = 'primary_member'
     where client_id = v_client and contact_id = v_contact;
  end if;

  -- The baseline every workspace gets. Left alone where staff have already
  -- raised it, so re-seeding a test account does not undo a real change.
  update public.workspaces
     set max_additional_members = 10
   where id = v_workspace
     and max_additional_members < 10;

  ------------------------------------------------------------------
  -- 5. Relationship-role label (SRS 5.5 / 13.14).
  ------------------------------------------------------------------
  if not exists (
    select 1 from public.contact_roles
    where contact_id = v_contact and related_type = 'client' and related_id = v_client
  ) then
    insert into public.contact_roles
      (contact_id, related_type, related_id, role_label, workspace_id, portal_access)
    values
      (v_contact, 'client', v_client, 'primary_member', v_workspace, true);
  end if;

  ------------------------------------------------------------------
  -- 6. The identity link this all hinges on: login -> person.
  ------------------------------------------------------------------
  insert into public.client_portal_identities (user_id, contact_id)
  values (v_user_id, v_contact)
  on conflict (user_id) do update set contact_id = excluded.contact_id;

  ------------------------------------------------------------------
  -- 7. Entitlements. The client gets client_portal (workspace-null — a client
  --    is not scoped to the professional's workspace). The professional gets
  --    whitbyos so both sides of the same data are testable.
  ------------------------------------------------------------------
  insert into public.entitlements
    (user_id, product, workspace_id, status, is_default_landing)
  select v_user_id, 'client_portal', null, 'active', true
  where not exists (
    select 1 from public.entitlements
    where user_id = v_user_id and product = 'client_portal'
  );

  update public.entitlements set status = 'active', updated_at = now()
   where user_id = v_user_id and product = 'client_portal';

  insert into public.entitlements
    (user_id, product, workspace_id, status, is_default_landing)
  select v_pro_id, 'whitbyos', v_workspace, 'active', true
  where not exists (
    select 1 from public.entitlements
    where user_id = v_pro_id and product = 'whitbyos'
  );

  raise notice 'Ready — professional=% client_login=% contact=% client=% workspace=%',
    v_pro_id, v_user_id, v_contact, v_client, v_workspace;
end $$;

-- ---------------------------------------------------------------------------
-- Verify. Expect exactly one row, portal_access = true, and
-- client_is_workspace_member = false — if that last one is true, the client-side
-- policies are being bypassed and the test is meaningless.
-- ---------------------------------------------------------------------------
select u.email                                as client_login,
       c.first_name || ' ' || c.last_name     as contact,
       cl.name                                as client_account,
       m.role,
       m.portal_access,
       e.status                               as portal_entitlement,
       exists (
         select 1 from public.workspace_members wm
         where wm.workspace_id = cl.workspace_id and wm.user_id = u.id
       )                                      as client_is_workspace_member
from public.client_portal_identities i
join public.users u                   on u.id = i.user_id
join public.contacts c                on c.id = i.contact_id
join public.whitbyos_client_members m on m.contact_id = c.id
join public.whitbyos_clients cl       on cl.id = m.client_id
left join public.entitlements e       on e.user_id = u.id and e.product = 'client_portal'
where lower(u.email) = lower('rohail12@yopmail.com');
