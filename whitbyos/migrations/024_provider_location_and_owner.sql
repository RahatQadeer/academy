-- The two fields 5.0a and 5.1a ask for that have nowhere to go.
--
-- Location — "NYC / Northeast US" in the export — is a market this provider
-- serves, and `companies.markets` is jsonb shared by all four products. A
-- single line of text does not want a jsonb document, and what one workspace
-- records about where a provider works is its own view of them rather than a
-- fact about the company. Both fields go on the Whitby record for that reason.
--
-- Relationship Owner is the professional who holds the relationship (§6.9),
-- which nothing stored anywhere.

alter table public.whitbyos_providers
  add column if not exists location text;

alter table public.whitbyos_providers
  add column if not exists relationship_owner_user_id uuid references public.users (id);
