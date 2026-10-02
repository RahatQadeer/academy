-- =====================================================================
-- Whitby — Providers: their own details, and their own history
-- Owner: Sabahat (whitbyos_*)
--
-- Five things the directory could not hold.
--
-- 1. A provider had no email or phone of its own. A company's reached only
--    through whatever contact happened to be linked to it, and an individual
--    provider had neither: the Add form took a name and nothing else, so a
--    person could be filed as a provider with no way to reach them at all.
--    `info@`, a switchboard number and a website are the firm's, not any one
--    person's, and belong on the provider.
--
-- 2. No address. `location` is a service area ("NYC / Northeast US"), which is
--    a different fact from where they actually are.
--
-- 3. An individual provider could not say which firm they are at. Both
--    `contact_id` and `company_id` were already here and nothing stopped a row
--    carrying both — except that the type was inferred from which one was set,
--    so filling in the second turned a person into a company. `kind` says it
--    outright and leaves the two columns free to mean what they say.
--
--    Nullable, with no backfill: rows written before this are read the old
--    way, which is still right for them.
--
-- 4. The Timeline on a provider read events belonging to the Requests it had
--    been put on, so a provider never used on one showed "Nothing has happened
--    yet" for ever, however much had happened. Events can hang off a provider
--    now.
--
-- 5. `request_id` was mandatory, which is what stopped 4 being possible. It is
--    optional now, with a constraint keeping every row attached to one or the
--    other rather than to nothing.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_providers
  add column if not exists kind text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists address text;

alter table public.whitbyos_providers
  drop constraint if exists whitbyos_providers_kind_check;
alter table public.whitbyos_providers
  add constraint whitbyos_providers_kind_check
  check (kind is null or kind in ('company', 'individual'));

-- ── The timeline learns about providers ──────────────────────────────
alter table public.whitbyos_timeline_events
  add column if not exists provider_id uuid
    references public.whitbyos_providers (id) on delete cascade;

alter table public.whitbyos_timeline_events
  alter column request_id drop not null;

alter table public.whitbyos_timeline_events
  drop constraint if exists whitbyos_timeline_events_subject_check;
alter table public.whitbyos_timeline_events
  add constraint whitbyos_timeline_events_subject_check
  check (request_id is not null or provider_id is not null);

create index if not exists whitbyos_timeline_events_provider_idx
  on public.whitbyos_timeline_events (provider_id, created_at desc)
  where provider_id is not null;

-- The existing policy reached rows through the Request. Rows that hang off a
-- provider instead reach the workspace through the provider. Additive: a row
-- with a request behaves exactly as it did.
drop policy if exists whitbyos_timeline_events_staff on public.whitbyos_timeline_events;
create policy whitbyos_timeline_events_staff on public.whitbyos_timeline_events
  for all
  using (
    exists (
      select 1 from public.whitbyos_requests r
      where r.id = request_id and public.is_workspace_member(r.workspace_id)
    )
    or exists (
      select 1 from public.whitbyos_providers p
      where p.id = provider_id and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.whitbyos_requests r
      where r.id = request_id and public.is_workspace_member(r.workspace_id)
    )
    or exists (
      select 1 from public.whitbyos_providers p
      where p.id = provider_id and public.is_workspace_member(p.workspace_id)
    )
  );
