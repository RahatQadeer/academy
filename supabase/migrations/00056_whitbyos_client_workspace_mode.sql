-- Whitby — client workspace mode
-- Owner: Sabahat (whitbyos_*)
--
-- Onboarding asks whether this organization uses Client Workspaces: a
-- separate space per client relationship. Firms that coordinate for one
-- practice, or that have no clients yet, choose No. The rest of Whitby then
-- hides client-specific navigation, the portal, and provider/client
-- restrictions rather than showing empty client machinery.
--
-- Default true so existing workspaces keep the behaviour they already have.
-- Safe to re-run.

alter table public.whitbyos_workspace_settings
  add column if not exists uses_client_workspaces boolean not null default true;

comment on column public.whitbyos_workspace_settings.uses_client_workspaces is
  'When false, this organization works as one workspace: Clients nav, portal, and client-scoped restrictions are hidden.';
