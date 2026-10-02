-- =====================================================================
-- Whitby — Providers: the twenty-fifth category, and notes on a provider
-- Owner: Sabahat (whitbyos_*), with one row in base taxonomy
--
-- Two things the client asked for.
--
-- 1. The directory is organised by the shared taxonomy rather than by six
--    words hard-coded in a dropdown. Twenty-four categories were seeded in
--    00008 from SRS Section 10; the client asked for twenty-five. Art &
--    Collections is the gap: art advisers, appraisers, fine-art shippers,
--    conservators, framers and storage had nowhere to go but "Other / Needs
--    Review", and they touch relocation, insurance, property and estate work
--    alike. Sensitive, because what a client owns and where it is kept is not
--    ordinary directory information.
--
--    Aviation's sibling, Marine / Yachting, was the other candidate. It only
--    applies to clients who own a boat; a collection of some kind is far more
--    common, and a charter broker can sit under Travel in a way that a
--    conservator cannot sit anywhere.
--
-- 2. Providers can carry notes. One free-text field would not do: the ask was
--    for notes one can keep adding to, each saying who wrote it and when, the
--    way a file builds up rather than a box being overwritten.
--
-- Safe to re-run.
-- =====================================================================

-- ── 1. The twenty-fifth category ─────────────────────────────────────
insert into public.taxonomy_categories (id, slug, name, sort_order, active, default_sensitivity)
values ('CAT-0015', 'art-collections', 'Art & Collections', 15, true, 'sensitive')
on conflict (id) do nothing;

-- ── 2. Notes on a provider ───────────────────────────────────────────
create table if not exists public.whitbyos_provider_notes (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.whitbyos_providers (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_user_id uuid references public.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists whitbyos_provider_notes_provider_idx
  on public.whitbyos_provider_notes (provider_id, created_at desc);

alter table public.whitbyos_provider_notes enable row level security;

-- Internal by definition. A client never reads these, so there is one policy
-- and it is the firm's: the workspace the provider belongs to.
drop policy if exists whitbyos_provider_notes_staff on public.whitbyos_provider_notes;
create policy whitbyos_provider_notes_staff on public.whitbyos_provider_notes
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.whitbyos_provider_notes to authenticated;
