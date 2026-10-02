-- How far a Knowledge file reaches.
--
-- Screen 13 draws a scope on every row and filters by it — All scopes, This
-- Workspace, Organization — and `whitbyos_knowledge` has no column for it. The
-- nearest, `status`, means whether the file is a draft or in use, which is a
-- different question and would collide the first time both are needed.
--
-- Organization means every workspace the firm has, not this one. Nothing in
-- Whitby joins workspaces into a firm yet, so an organization file is visible
-- to its own workspace and marked as intended to be shared — which is honest
-- about where that stands rather than pretending a reach that does not exist.

alter table public.whitbyos_knowledge
  add column if not exists scope text not null default 'workspace';
