-- 5.0a — "Link to Client Workspace", the one field on Add Provider that the
-- table could not hold.
--
-- The modal says what the column has to mean: it is optional, its first option
-- is "None — available to all workspaces", and its help text is "(optional —
-- providers can be shared across workspaces)". So a provider belongs to at
-- most one client, and a provider with none is the shared directory the
-- Providers list has been all along. Nullable says both.
--
-- `on delete set null` rather than cascade, deliberately: deleting a client
-- must not take a provider with it. The relationship with the provider is the
-- firm's, and outlives any one piece of work — that is the whole reason the
-- directory exists.

alter table public.whitbyos_providers
  add column if not exists client_id uuid references public.whitbyos_clients(id) on delete set null;

create index if not exists whitbyos_providers_client_idx
  on public.whitbyos_providers (client_id)
  where client_id is not null;
