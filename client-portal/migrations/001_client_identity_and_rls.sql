-- Client Portal — identity link and client-side row-level security.
-- Owner: Rohail (client_portal_*). Sign-off: Sabahat (whitbyos_*), Laiba (base).
--
-- ADDITIVE ONLY. No policy belonging to another module is dropped or modified.
-- Policy names end in _client, pairing with Whitby's _staff suffix; Postgres
-- OR-combines permissive policies so both sides apply to the same table.
-- The three base-owned policies that need narrowing live in 002, separately,
-- so this file can be approved without them.
--
-- WHY THIS EXISTS
-- Every policy written so far answers "is this person a member of the workspace?"
-- A client is not: they are a `contacts` row, not a `workspace_members` row. So
-- before this migration a Client Portal login matched zero rows on every table it
-- reads, and nothing connected an `auth.users` id to a contact in the first place.
--
-- WHAT IS SAFE ABOUT IT
-- Every policy below is added, not altered. PostgreSQL OR-combines permissive
-- policies, so the professional side's `is_workspace_member()` access — including
-- the 17 _staff policies from whitbyos/migrations — is exactly what it was.
-- The only DROPs are on this module's own client_portal_* tables.

-- SAFE TO RUN. The SQL Editor flags this as "destructive" because it contains
-- the keywords DROP / ALTER / REVOKE. It is a keyword match, not an analysis.
-- There is no DROP TABLE, DROP COLUMN, DELETE, or TRUNCATE anywhere in this
-- file — grep it. The only two DROPs are DROP POLICY on this module's own
-- client_portal_* tables, and each is replaced by a tighter policy a few lines
-- later. Both tables are empty.
--
-- Wrapped in an explicit transaction: Postgres DDL is transactional, so if any
-- statement fails the whole file rolls back and the database is untouched.

begin;

-- ---------------------------------------------------------------------------
-- 1. The identity link
-- ---------------------------------------------------------------------------

-- Deliberately a `client_portal_`-prefixed join table rather than a `user_id`
-- column on base `contacts`: this module owns the mapping between a login and
-- the person it represents, and base keeps sole ownership of the contact record.
create table if not exists public.client_portal_identities (
  user_id uuid primary key references public.users (id) on delete cascade,
  contact_id uuid not null unique references public.contacts (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.client_portal_identities enable row level security;

create policy client_portal_identities_select_self on public.client_portal_identities
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Resolver functions
--
-- All SECURITY DEFINER so they read through RLS rather than recursing into the
-- policies that call them. Each is STABLE, so Postgres evaluates them once per
-- statement instead of once per row.
-- ---------------------------------------------------------------------------

create or replace function public.portal_contact_id()
returns uuid language sql stable security definer set search_path = public as $$
  select contact_id from public.client_portal_identities where user_id = auth.uid();
$$;

create or replace function public.portal_client_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.client_id
  from public.whitbyos_client_members m
  where m.contact_id = public.portal_contact_id()
    and m.portal_access = true;
$$;

create or replace function public.portal_is_client_of(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_client_id is not null
     and exists (select 1 from public.portal_client_ids() c where c = p_client_id);
$$;

-- Fellow members of the same client account, so a client can render "Sarah Chen"
-- rather than a bare uuid — without being able to read the whole contacts table.
create or replace function public.portal_contact_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct m.contact_id
  from public.whitbyos_client_members m
  where m.client_id in (select public.portal_client_ids());
$$;

-- SRS 13.14.14: client_account is visible to every permitted member; the other
-- two visibilities require an explicit participant row for this contact.
create or replace function public.portal_can_see_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.whitbyos_requests r
    where r.id = p_request_id
      and public.portal_is_client_of(r.client_id)
      and (
        r.visibility = 'client_account'
        or exists (
          select 1
          from public.whitbyos_request_participants p
          where p.request_id = r.id
            and p.participant_type = 'contact'
            and p.participant_id = public.portal_contact_id()
        )
      )
  );
$$;

-- Ownership without the visibility test. Needed where a client acts on a request
-- they just created but cannot yet "see" — a private_to_requestor row has no
-- participant until the participant insert lands.
create or replace function public.portal_request_client_ok(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.whitbyos_requests r
    where r.id = p_request_id and public.portal_is_client_of(r.client_id)
  );
$$;

create or replace function public.portal_in_thread(p_thread_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.whitbyos_message_participants mp
    where mp.thread_id = p_thread_id
      and mp.participant_type = 'contact'
      and mp.participant_id = public.portal_contact_id()
      and mp.removed_at is null
  );
$$;

-- SRS 13.6.4 — returns the cutoff for a participant added with `from_added`
-- history, or null when they may read the full thread.
create or replace function public.portal_thread_history_from(p_thread_id uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select min(mp.added_at)
  from public.whitbyos_message_participants mp
  where mp.thread_id = p_thread_id
    and mp.participant_type = 'contact'
    and mp.participant_id = public.portal_contact_id()
    and mp.removed_at is null
    and mp.history_visibility = 'from_added';
$$;

create or replace function public.portal_form_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct s.form_id
  from public.whitbyos_form_submissions s
  where public.portal_is_client_of(s.client_id);
$$;

-- ---------------------------------------------------------------------------
-- 3. Base tables
-- ---------------------------------------------------------------------------

create policy contacts_select_client on public.contacts
  for select using (id in (select public.portal_contact_ids()));

-- A client edits their own contact record from Profile & Settings, nobody else's.
create policy contacts_update_client on public.contacts
  for update using (id = public.portal_contact_id())
  with check (id = public.portal_contact_id());

create policy documents_select_client on public.documents
  for select using (
    visibility = 'client_visible'
    and (
      (context_type = 'client' and public.portal_is_client_of(context_id))
      or (context_type = 'request' and public.portal_can_see_request(context_id))
      or (context_type = 'contact' and context_id = public.portal_contact_id())
    )
  );

-- A client may only ever create a client_visible document, never internal or
-- restricted, and only against their own client or a request they can act on.
create policy documents_insert_client on public.documents
  for insert with check (
    visibility = 'client_visible'
    and uploaded_by_user_id = auth.uid()
    and (
      (context_type = 'client' and public.portal_is_client_of(context_id))
      or (context_type = 'request' and public.portal_request_client_ok(context_id))
    )
  );

-- ---------------------------------------------------------------------------
-- 4. WhitbyOS tables — client-side read paths
-- ---------------------------------------------------------------------------

create policy whitbyos_clients_select_client on public.whitbyos_clients
  for select using (public.portal_is_client_of(id));

create policy whitbyos_client_members_select_client on public.whitbyos_client_members
  for select using (public.portal_is_client_of(client_id));

create policy whitbyos_requests_select_client on public.whitbyos_requests
  for select using (public.portal_can_see_request(id));

create policy whitbyos_request_participants_select_client
  on public.whitbyos_request_participants
  for select using (public.portal_request_client_ok(request_id));

-- Draft and review updates are internal; only published ones reach the client.
create policy whitbyos_updates_select_client on public.whitbyos_updates
  for select using (
    public.portal_is_client_of(client_id) and status = 'published'
  );

-- Plans & Updates — the client telling the professional something. Restricted to
-- that one type so a client can never author a Progress Update about themselves.
create policy whitbyos_updates_insert_client on public.whitbyos_updates
  for insert with check (
    public.portal_is_client_of(client_id)
    and type = 'plans_update'
    and status = 'published'
  );

create policy whitbyos_forms_select_client on public.whitbyos_forms
  for select using (id in (select public.portal_form_ids()));

create policy whitbyos_form_submissions_select_client
  on public.whitbyos_form_submissions
  for select using (public.portal_is_client_of(client_id));

create policy whitbyos_form_submissions_update_client
  on public.whitbyos_form_submissions
  for update using (public.portal_is_client_of(client_id))
  with check (public.portal_is_client_of(client_id));

-- `status` arrived with whitbyos/014: a row is either 'draft' or 'sent'. WhitbyOS
-- autosaves a reply while the professional types, so unsent rows now sit in this
-- table permanently. The guard belongs in the policy rather than in the query —
-- a draft is not something the client is merely not shown, it is something they
-- must not be able to read, and that has to hold for any query written later.
-- Kept in step with whitbyos/017; changing one without the other leaks drafts.
create policy whitbyos_messages_select_client on public.whitbyos_messages
  for select using (
    status = 'sent'
    and public.portal_in_thread(thread_id)
    and (
      public.portal_thread_history_from(thread_id) is null
      or created_at >= public.portal_thread_history_from(thread_id)
    )
  );

-- A message written from the portal is sent by definition — there is no draft
-- state on this side — so it may never arrive as anything else.
create policy whitbyos_messages_insert_client on public.whitbyos_messages
  for insert with check (
    status = 'sent'
    and public.portal_in_thread(thread_id)
    and sender_type = 'contact'
    and sender_id = public.portal_contact_id()
  );

create policy whitbyos_message_participants_select_client
  on public.whitbyos_message_participants
  for select using (public.portal_in_thread(thread_id));

-- SRS 13.5.3 — internal professional deadlines are never automatically visible.
create policy whitbyos_calendar_select_client on public.whitbyos_calendar_events
  for select using (
    public.portal_is_client_of(linked_client_id) and client_visible = true
  );

-- ---------------------------------------------------------------------------
-- 5. Client Portal tables — tightening this module's own policies
-- ---------------------------------------------------------------------------

-- Was `has_entitlement('client_portal')`, which let any portal user anywhere read
-- every client's access requests. Scoped to the caller's own client account.
drop policy if exists client_portal_access_requests_all
  on public.client_portal_access_requests;

create policy client_portal_access_requests_staff
  on public.client_portal_access_requests
  for all using (
    exists (
      select 1 from public.whitbyos_clients c
      where c.id = client_id and public.is_workspace_member(c.workspace_id)
    )
  );

create policy client_portal_access_requests_select_client
  on public.client_portal_access_requests
  for select using (public.portal_is_client_of(client_id));

create policy client_portal_access_requests_insert_client
  on public.client_portal_access_requests
  for insert with check (
    public.portal_is_client_of(client_id)
    and requested_by_contact_id = public.portal_contact_id()
    and status = 'pending'
  );

-- Was `auth.uid() is not null` — every authenticated user could read and rewrite
-- anyone's notification preferences.
drop policy if exists client_portal_notification_prefs_all
  on public.client_portal_notification_prefs;

create policy client_portal_notification_prefs_own
  on public.client_portal_notification_prefs
  for all using (contact_id = public.portal_contact_id())
  with check (contact_id = public.portal_contact_id());

-- ---------------------------------------------------------------------------
-- 6. Write RPCs
--
-- Two client writes span more than one table and must be atomic. Doing them as
-- separate statements deadlocks against the policies above: a fresh
-- private_to_requestor request has no participant row yet, so the client cannot
-- SELECT the row they just inserted, and `insert ... returning` fails.
-- ---------------------------------------------------------------------------

create or replace function public.portal_submit_request(
  p_title text,
  p_description text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_contact uuid := public.portal_contact_id();
  v_client uuid;
  v_workspace uuid;
  v_request uuid;
begin
  if v_contact is null then
    raise exception 'No client portal identity for this account';
  end if;
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'A title is required';
  end if;

  select c.id, c.workspace_id into v_client, v_workspace
  from public.whitbyos_clients c
  where c.id in (select public.portal_client_ids())
  limit 1;

  if v_client is null then
    raise exception 'This account is not linked to a client';
  end if;

  insert into public.whitbyos_requests
    (client_id, workspace_id, title, desired_outcome, status, visibility)
  values
    (v_client, v_workspace, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
     'open', 'private_to_requestor')
  returning id into v_request;

  insert into public.whitbyos_request_participants
    (request_id, participant_type, participant_id, role)
  values
    (v_request, 'contact', v_contact, 'requestor');

  return v_request;
end;
$$;

create or replace function public.portal_start_thread(
  p_body text,
  p_request_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_contact uuid := public.portal_contact_id();
  v_client uuid;
  v_workspace uuid;
  v_thread uuid := gen_random_uuid();
begin
  if v_contact is null then
    raise exception 'No client portal identity for this account';
  end if;
  if coalesce(btrim(p_body), '') = '' then
    raise exception 'A message is required';
  end if;

  select c.id, c.workspace_id into v_client, v_workspace
  from public.whitbyos_clients c
  where c.id in (select public.portal_client_ids())
  limit 1;

  if v_client is null then
    raise exception 'This account is not linked to a client';
  end if;

  if p_request_id is not null and not public.portal_request_client_ok(p_request_id) then
    raise exception 'That request is not available to this account';
  end if;

  insert into public.whitbyos_message_participants
    (thread_id, participant_type, participant_id, history_visibility)
  values
    (v_thread, 'contact', v_contact, 'full');

  insert into public.whitbyos_messages
    (workspace_id, thread_id, request_id, client_id, sender_type, sender_id, body, source)
  values
    (v_workspace, v_thread, p_request_id, v_client, 'contact', v_contact, btrim(p_body), 'native');

  return v_thread;
end;
$$;

revoke all on function public.portal_submit_request(text, text) from public;
revoke all on function public.portal_start_thread(text, uuid) from public;
grant execute on function public.portal_submit_request(text, text) to authenticated;
grant execute on function public.portal_start_thread(text, uuid) to authenticated;

commit;
