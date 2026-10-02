-- Approves a pending Client Portal access request, without the professional.
--
-- NOT a schema migration and NOT auto-run: unnumbered, like
-- `seed_test_account.sql`, so `supabase db reset` never picks it up. Run it by
-- hand from the SQL editor.
--
-- WHY THIS EXISTS
-- Screen 2.1.2.1 is built (`approveAccessRequest` in whitbyos/clients/actions.ts)
-- and approving through it is the real path. This is for the case where you do
-- not want to stop and sign in as the professional to move one row — testing the
-- portal's own behaviour once somebody has been added, which is otherwise gated
-- behind an approval you already know the outcome of.
--
-- It does the same three writes that action does, in the same order, and stops
-- short of the fourth: `inviteToPortal` calls the Supabase auth API to send an
-- invitation, and SQL cannot. See "THE LOGIN" below for what that costs.
--
-- Idempotent. Re-running finds the contact and the membership it made last time
-- and updates them rather than adding a second of each.
--
-- ---------------------------------------------------------------------------
-- THE LOGIN
--
-- Approving creates the *person on the account*. It does not create a way for
-- them to sign in, because an auth user is not something SQL can conjure — the
-- real flow mails them a link and `app/auth/accept-invite/route.ts` builds the
-- account when they follow it.
--
-- That split is fine for most of what you would test here. The picker on
-- Messages, People & Access, and the seat counts all read
-- `whitbyos_client_members` and light up as soon as this runs.
--
-- To actually sign in *as* the new person, they need a `public.users` row:
-- sign up at /signup with their email once, then re-run this file. Step 5 will
-- find the account and link it. The same contract `seed_test_account.sql`
-- states, for the same reason.
-- ---------------------------------------------------------------------------

do $$
declare
  -- WHICH REQUEST. The email on the pending request you want approved. Every
  -- pending request for this address is taken, which in practice is one.
  v_email text := 'clientteam@yopmail.com';

  -- Null takes the role the client asked for. Set it to override:
  -- 'additional_member' or 'authorized_user'.
  v_role_override text := null;

  v_request     record;
  v_client_name text;
  v_workspace   uuid;
  v_contact     uuid;
  v_role        text;
  v_perms       jsonb;
  v_user_id     uuid;
  v_first       text;
  v_last        text;
  v_name        text;
begin
  ------------------------------------------------------------------
  -- 1. The request, and the account it belongs to.
  ------------------------------------------------------------------
  select r.* into v_request
  from public.client_portal_access_requests r
  where lower(r.person_email) = lower(v_email)
    and r.status = 'pending'
  order by r.created_at desc
  limit 1;

  -- `not found` rather than `v_request is null`. A record is only IS NULL when
  -- every field in it is null, which is true here by accident and would stop
  -- being true the day a column gained a default — the flag is the fact.
  if not found then
    raise exception
      'No pending access request for %. Already approved, or the address is wrong.', v_email;
  end if;

  select c.name, c.workspace_id into v_client_name, v_workspace
  from public.whitbyos_clients c
  where c.id = v_request.client_id;

  if v_workspace is null then
    raise exception 'Request % names a client that does not exist.', v_request.id;
  end if;

  ------------------------------------------------------------------
  -- 2. The permissions.
  --
  -- Taken from `requested_areas` — what the client actually ticked — rather
  -- than the four defaults screen 2.1.2.1 opens with. That is the behaviour
  -- the review dialog is meant to grow (it reads the column for nothing
  -- today), and for a test fixture the client's own ask is the more useful
  -- answer anyway.
  --
  -- A request written before client-portal/009 carries no areas. An empty
  -- object is the honest record of that: `readAreas` in the portal treats
  -- "nothing decided" as full access and says so on the screen, which is the
  -- same conclusion, arrived at without inventing ticks nobody made.
  ------------------------------------------------------------------
  v_role := coalesce(
    v_role_override,
    case v_request.requested_role
      when 'authorized_user' then 'authorized_user'
      when 'additional_member' then 'additional_member'
      else 'additional_member'
    end
  );

  select coalesce(
           jsonb_object_agg(area, true) filter (where area is not null),
           '{}'::jsonb
         )
    into v_perms
  from jsonb_array_elements_text(
         case
           when jsonb_typeof(coalesce(v_request.requested_areas, '[]'::jsonb)) = 'array'
             then v_request.requested_areas
           else '[]'::jsonb
         end
       ) as t(area);

  v_perms := v_perms || jsonb_build_object('view_only', false);

  ------------------------------------------------------------------
  -- 3. The contact. §5.4 keeps people canonical, so an existing record for
  --    this address is reused rather than duplicated.
  ------------------------------------------------------------------
  v_name  := coalesce(nullif(btrim(v_request.person_name), ''), split_part(v_email, '@', 1));
  v_first := split_part(v_name, ' ', 1);
  v_last  := coalesce(nullif(btrim(substr(v_name, length(v_first) + 1)), ''), '');

  select id into v_contact
  from public.contacts
  where lower(email) = lower(v_email)
  limit 1;

  if v_contact is null then
    insert into public.contacts
      (first_name, last_name, email, title_role, source, created_by_workspace_id)
    values
      (v_first, v_last, v_email, v_client_name, 'portal_access_request', v_workspace)
    returning id into v_contact;
  end if;

  ------------------------------------------------------------------
  -- 4. The membership. This is the row that makes them a person on the
  --    account — the Messages picker, People & Access and the seat counts
  --    all read it.
  ------------------------------------------------------------------
  if exists (
    select 1 from public.whitbyos_client_members
    where client_id = v_request.client_id and contact_id = v_contact
  ) then
    update public.whitbyos_client_members
       set role = v_role::public.contact_role_label,
           portal_access = true,
           permissions = v_perms
     where client_id = v_request.client_id and contact_id = v_contact;
  else
    insert into public.whitbyos_client_members
      (client_id, contact_id, role, portal_access, permissions)
    values
      (v_request.client_id, v_contact, v_role::public.contact_role_label, true, v_perms);
  end if;

  ------------------------------------------------------------------
  -- 5. The login, if there is one to link.
  --
  -- `client_portal_identities.user_id` is the primary key and `contact_id` is
  -- unique, so this is upserted on both: re-running after the person finally
  -- signs up is how the link gets made, and it must not collide with the row
  -- it wrote last time.
  ------------------------------------------------------------------
  select id into v_user_id
  from public.users where lower(email) = lower(v_email);

  if v_user_id is not null then
    insert into public.client_portal_identities (user_id, contact_id)
    values (v_user_id, v_contact)
    on conflict (user_id) do update set contact_id = excluded.contact_id;

    raise notice 'Linked % to their login. They can sign in now.', v_email;
  else
    raise notice
      'No public.users row for % yet, so they are on the account but cannot sign in. Sign up once at /signup with that address, then re-run this file.',
      v_email;
  end if;

  ------------------------------------------------------------------
  -- 6. Close the request. Last, so a failure above leaves it pending and
  --    this file can simply be run again.
  ------------------------------------------------------------------
  -- Cast: `status` is `client_portal_access_status`, not text, and a bare CASE
  -- returns text. Postgres will not coerce it for you here.
  update public.client_portal_access_requests
     set status = (case
                    when v_role = coalesce(v_request.requested_role, v_role)
                      then 'approved_as_requested'
                    else 'approved_edited'
                  end)::public.client_portal_access_status,
         reviewed_at = now()
   where id = v_request.id;

  raise notice 'Approved % as % on client %.', v_name, v_role, v_client_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Verification
--
--   select c.email, m.role, m.portal_access, m.permissions,
--          (i.user_id is not null) as can_sign_in
--   from public.whitbyos_client_members m
--   join public.contacts c on c.id = m.contact_id
--   left join public.client_portal_identities i on i.contact_id = c.id
--   where m.client_id = (
--     select client_id from public.client_portal_access_requests
--     where lower(person_email) = lower('clientteam@yopmail.com') limit 1
--   );
--
-- Expected: two rows — the primary member, and the person just approved with
-- portal_access true. `can_sign_in` false on the new one is the "sign up first"
-- case in step 5, not a failure.
-- ---------------------------------------------------------------------------
