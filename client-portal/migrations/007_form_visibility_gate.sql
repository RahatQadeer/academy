-- Client Portal — a Form's visibility gate is enforced for real.
-- Owner: Rohail (client_portal_*). Sign-off: Sabahat (whitbyos_*).
--
-- ADDITIVE IN EFFECT, not in mechanism: the three policies and one function
-- touched below all belong to this module (001_client_identity_and_rls.sql),
-- so amending them is this module tightening its own work, not editing
-- another module's. Nothing belonging to whitbyos/ or base/ is touched. Each
-- object is replaced with a strictly narrower version of itself — nothing a
-- client could read before keeps being readable under some new condition;
-- some things a client could technically have read before can no longer be.
--
-- WHY THIS EXISTS
--
-- `whitbyos_forms.visibility` already carries the same Internal / Client
-- Visible / Restricted levels 005 used for Tasks and 001 used for Documents —
-- SRS 7.2.7 names it explicitly: "A Form respects the standard Internal,
-- Client Visible, and Restricted visibility levels." But 001's read path for
-- Forms never checks it:
--
--   create or replace function public.portal_form_ids() ... as $$
--     select distinct s.form_id
--     from public.whitbyos_form_submissions s
--     where public.portal_is_client_of(s.client_id);
--   $$;
--
--   create policy whitbyos_forms_select_client on public.whitbyos_forms
--     for select using (id in (select public.portal_form_ids()));
--
--   create policy whitbyos_form_submissions_select_client
--     on public.whitbyos_form_submissions
--     for select using (public.portal_is_client_of(client_id));
--
-- A client can read any Form — Internal or Restricted included — the instant
-- a `whitbyos_form_submissions` row exists naming them as the client, with no
-- regard for what the form's own visibility says. Nothing exploited this
-- before now because nothing ever inserted that submission row for anyone but
-- the client themselves (`client-portal/lib/actions/forms.ts`, which only
-- writes back to a row that already names them). whitbyos/forms/actions.ts's
-- new `sendForm()` is what starts inserting submissions from the professional
-- side, and it already refuses to send anything but a Client Visible form —
-- but that is one call site, in application code, and every other table this
-- schema gates on visibility (Documents, Updates, Tasks) enforces the same
-- rule in the policy itself rather than trusting the one place that currently
-- calls it. A form flipped back to Internal after being sent should stop
-- being visible, the same way a Document does when its visibility changes —
-- and that can only happen in the database, not in application code that runs
-- once at send time.
--
-- WHY THE SUBMISSION POLICIES CHANGE TOO, NOT JUST THE FORM'S
--
-- `whitbyos_form_submissions_select_client` and `_update_client` are gated
-- only on `client_id`, never on the parent form's visibility. Narrowing
-- `whitbyos_forms_select_client` alone leaves the submission row itself
-- readable — the embedded `whitbyos_forms(title, fields)` a client-side query
-- joins in (client-portal/lib/data/forms.ts) would just come back null for a
-- gated form, since PostgREST evaluates RLS per table rather than failing the
-- outer row. That renders a submission the client cannot act on: a title-less
-- "Form" entry with no fields and no way to answer it, sitting in their
-- Action Required tab. Gating the submission policies the same way makes the
-- whole row disappear cleanly instead, which is what "not visible" has to
-- mean for something the client is meant to complete.
--
-- SAFE TO RUN. No DROP TABLE, DROP COLUMN, DELETE, or TRUNCATE. Every DROP
-- POLICY below names a policy this same file recreates immediately after, all
-- four of which are this module's own (`_client` suffix, defined in 001).
-- Wrapped in an explicit transaction: Postgres DDL is transactional, so a
-- failure anywhere rolls the whole file back.

begin;

create or replace function public.portal_form_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct s.form_id
  from public.whitbyos_form_submissions s
  join public.whitbyos_forms f on f.id = s.form_id
  where public.portal_is_client_of(s.client_id)
    and f.visibility = 'client_visible';
$$;

drop policy if exists whitbyos_forms_select_client on public.whitbyos_forms;
create policy whitbyos_forms_select_client on public.whitbyos_forms
  for select using (id in (select public.portal_form_ids()));

drop policy if exists whitbyos_form_submissions_select_client
  on public.whitbyos_form_submissions;
create policy whitbyos_form_submissions_select_client
  on public.whitbyos_form_submissions
  for select using (
    public.portal_is_client_of(client_id)
    and exists (
      select 1 from public.whitbyos_forms f
      where f.id = form_id and f.visibility = 'client_visible'
    )
  );

-- A client's own submit/save-draft (client-portal/lib/actions/forms.ts) only
-- ever updates a row it can already select, so this mirrors the select policy
-- rather than changing what a client can do with a form they can see.
drop policy if exists whitbyos_form_submissions_update_client
  on public.whitbyos_form_submissions;
create policy whitbyos_form_submissions_update_client
  on public.whitbyos_form_submissions
  for update using (
    public.portal_is_client_of(client_id)
    and exists (
      select 1 from public.whitbyos_forms f
      where f.id = form_id and f.visibility = 'client_visible'
    )
  )
  with check (
    public.portal_is_client_of(client_id)
    and exists (
      select 1 from public.whitbyos_forms f
      where f.id = form_id and f.visibility = 'client_visible'
    )
  );

commit;

-- VERIFY
-- select policyname from pg_policies
--   where tablename in ('whitbyos_forms', 'whitbyos_form_submissions')
--   and policyname like '%_client';
--
-- As a signed-in client, both should return only submissions/forms where the
-- form is Client Visible:
--   select * from public.whitbyos_form_submissions where client_id in (select public.portal_client_ids());
--   select id, visibility from public.whitbyos_forms;
--
-- Flip a sent form's visibility back to 'internal' as staff, then re-run the
-- first query as that client — the submission should no longer come back.
