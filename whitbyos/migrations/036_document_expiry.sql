-- =====================================================================
-- Whitby — the date a document stops being good
-- Owner: Sabahat (whitbyos_*, but this one is base's `documents`)
--
-- 21a's Needs column has four answers. Three are already in the row: a
-- document with no file asks to be uploaded, one with a signed date asks to be
-- reviewed, one without asks to be signed. The fourth — Update, drawn against
-- "Insurance Certificate (expiring)" — has nothing to read.
--
-- `documents` has `effective_date`, which is the date a document takes effect,
-- and `signed_date`. Neither says when it runs out. An insurance certificate,
-- a visa, a licence and a lease all expire, and the expiry is the whole reason
-- the row is on the Action Needed tab.
--
-- Reusing `effective_date` for it was the alternative and is worse: the Update
-- dialog already labels that field "expires", which is quietly wrong wherever
-- a document has a real start date, and no query could tell the two meanings
-- apart afterwards.
--
-- Note this is base's table, shared with the Portal and Partner Center. The
-- column is nullable with no default, so nothing that exists changes and no
-- reader that ignores it behaves differently.
--
-- Safe to re-run.
-- =====================================================================

alter table public.documents
  add column if not exists expires_at date;

-- The Action Needed tab reads by soonest, which is the order it is useful in.
create index if not exists documents_expiry_idx
  on public.documents (expires_at)
  where expires_at is not null;


-- =====================================================================
-- VERIFY — should return one row.
-- =====================================================================
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'documents'
--   and column_name = 'expires_at';
