-- =====================================================================
-- Whitby — which Work Stream a provider was brought in for
-- Owner: Sabahat (whitbyos_*)
--
-- WP.17c names a provider on each Work Stream's card — "Marbury Immigration"
-- under Visa & Immigration, "Chelsea Property Ptnrs" under Housing Search,
-- "Rothwell & Co" under Logistics. Three streams, three different firms, on
-- one Request.
--
-- `whitbyos_provider_options` already ties a provider to the Request. What it
-- cannot say is which part of the work that provider is for, so the card had
-- nothing to name and the Work Stream's own screen could not list its
-- providers either.
--
-- A nullable column rather than a new table: the row already exists and
-- already belongs to the Request. Null keeps its present meaning — a provider
-- put forward for the engagement as a whole, not for one stream of it — so
-- nothing that exists today changes.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_provider_options
  add column if not exists workstream_id uuid
    references public.whitbyos_workstreams (id) on delete set null;

-- on delete set null, not cascade: removing a Work Stream must not take the
-- provider option off the Request with it. The firm was still put forward.

-- The card reads one stream's providers; the Request's panel reads them all.
create index if not exists whitbyos_provider_options_workstream_idx
  on public.whitbyos_provider_options (workstream_id)
  where workstream_id is not null;


-- =====================================================================
-- VERIFY
-- =====================================================================
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_provider_options'
--   and column_name = 'workstream_id';
