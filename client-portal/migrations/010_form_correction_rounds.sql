-- What was asked for, after it has been answered.
--
-- `whitbyos_form_submissions` holds one `correction_note` and one `reviewed_at`,
-- and both describe the *current* state of the submission. That is the right
-- shape for the professional's queue and it cannot hold a loop:
--
--   * Resubmitting clears `correction_note`, because leaving it would keep
--     reading as an open request on both sides. So the moment a client acts on
--     a correction, the thing they were asked for is gone from the record — they
--     cannot check afterwards that they did what was asked.
--   * A second correction overwrites the first. A form sent back twice keeps
--     only the second note, and nothing anywhere says it went round twice.
--
-- Neither is a bug in the professional's side, and neither should be fixed by
-- widening a `whitbyos_*` column that other screens read. This is a Client
-- Portal table, in the `client_portal_*` namespace this module owns, recording
-- a fact the portal is the only place that needs: the history of the loop.
--
-- One row per completed round: what was asked, when it was asked, who answered
-- it, and when. Written at the moment of resubmission, which is the last moment
-- the note still exists on the submission.

create table if not exists public.client_portal_form_corrections (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.whitbyos_form_submissions (id) on delete cascade,
  -- Denormalised from the submission so the policies below can be written
  -- without a join into a table whose own policies would then have to hold.
  -- It is also what makes a round survive its form being reorganised.
  client_id uuid not null references public.whitbyos_clients (id) on delete cascade,
  -- The professional's own words. Nullable: a correction may be asked for with
  -- no note, and a round with no note is still a round that happened.
  note text,
  -- `whitbyos_form_submissions.reviewed_at` as it stood when the ask was made.
  asked_at timestamptz,
  answered_by_contact_id uuid references public.contacts (id) on delete set null,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists client_portal_form_corrections_submission_idx
  on public.client_portal_form_corrections (submission_id, answered_at);

alter table public.client_portal_form_corrections enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
--
-- Two readers and one writer, following this module's `_client` / `_staff`
-- convention so neither side has to drop or edit the other's policy.
--
-- The client may read their own rounds and append one. They may not update or
-- delete: a record of what was asked is worth nothing if the person who was
-- asked can revise it. There is deliberately no `for all` policy here.
--
-- The insert is pinned three ways — their own client, their own contact id as
-- the answerer, and a submission that is actually theirs — so the append cannot
-- be used to write a round onto somebody else's form, or to attribute one to a
-- person who did not do it.
-- ---------------------------------------------------------------------------

drop policy if exists client_portal_form_corrections_select_client
  on public.client_portal_form_corrections;

create policy client_portal_form_corrections_select_client
  on public.client_portal_form_corrections
  for select using (public.portal_is_client_of(client_id));

drop policy if exists client_portal_form_corrections_insert_client
  on public.client_portal_form_corrections;

create policy client_portal_form_corrections_insert_client
  on public.client_portal_form_corrections
  for insert with check (
    public.portal_is_client_of(client_id)
    and answered_by_contact_id = public.portal_contact_id()
    and submission_id in (
      select s.id
      from public.whitbyos_form_submissions s
      where s.client_id = client_id
    )
  );

-- The professional reaches it the way they reach every other row belonging to a
-- client of theirs. Read-only: the history is written by the side that answered.
drop policy if exists client_portal_form_corrections_staff
  on public.client_portal_form_corrections;

create policy client_portal_form_corrections_staff
  on public.client_portal_form_corrections
  for select using (
    exists (
      select 1 from public.whitbyos_clients c
      where c.id = client_id and public.is_workspace_member(c.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Verification
--
--   select policyname, cmd
--   from pg_policies
--   where tablename = 'client_portal_form_corrections'
--   order by policyname;
--
-- Expected: three rows — _insert_client (INSERT), _select_client (SELECT),
-- _staff (SELECT). No UPDATE or DELETE policy on this table, by design.
-- ---------------------------------------------------------------------------
