-- =====================================================================
-- Whitby — a Knowledge file can belong to one client
-- Owner: Sabahat (whitbyos_*)
--
-- `whitbyos_knowledge.scope` has offered "This Workspace" and "Organization"
-- since it was built, and the two meant the same thing: every row carries the
-- firm's `workspace_id`, the list reads them all, and nothing anywhere treats
-- one differently from the other. A choice that changes nothing is worse than
-- no choice — somebody files a client's visa notes under "This Workspace"
-- believing they are kept apart, and they are not.
--
-- So the second scope becomes the one the product actually needs: a file that
-- belongs to a single client workspace, alongside the firm's own library.
--
--   organization  → the practice's own knowledge, read while working on any
--                   client. `client_id` is null.
--   client        → about one client, and shown while that client is open.
--                   `client_id` names them.
--
-- There is no third "both": an organization file is already available
-- everywhere, and a client file is about one client by definition.
--
-- Existing rows: `workspace` becomes `organization`, because that is what they
-- have always behaved as. Nothing is hidden from anyone by this migration.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_knowledge
  add column if not exists client_id uuid
    references public.whitbyos_clients (id) on delete cascade;

create index if not exists whitbyos_knowledge_client_idx
  on public.whitbyos_knowledge (client_id);

update public.whitbyos_knowledge
set scope = 'organization'
where scope is null or scope = 'workspace';


-- =====================================================================
-- VERIFY — one column, and no row left on the old scope.
-- =====================================================================
-- select column_name from information_schema.columns
-- where table_name = 'whitbyos_knowledge' and column_name = 'client_id';
--
-- select scope, count(*) from public.whitbyos_knowledge group by scope;
