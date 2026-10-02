-- =====================================================================
-- Whitby — a client's classification, as the firm words it
-- Owner: Sabahat (whitbyos_*)
--
-- Settings → Workspace has let a firm write its own client classifications
-- since the beginning — Family, Household, Company, Estate — and nothing read
-- them. A client's "Type" came from a four-value enum (`client_type`:
-- individual, family, company, organization) written into two files, so the
-- list the firm kept and the list it could choose from were different lists,
-- and "Estate" was not on either.
--
-- This is the firm's own word for what a client is. `client_type` stays where
-- it is: it is the structural kind, still written on create, and every screen
-- now prefers the classification and falls back to it for clients recorded
-- before today.
--
-- Free text rather than a foreign key to the settings array: a firm renaming
-- "Household" must not silently re-label the clients it already gave that
-- word, and a classification removed from the list is still the truth about
-- the client who carries it.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_clients
  add column if not exists classification text;

create index if not exists whitbyos_clients_classification_idx
  on public.whitbyos_clients (workspace_id, classification);


-- =====================================================================
-- VERIFY — should return one row, and one index.
-- =====================================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_clients'
--   and column_name = 'classification';
