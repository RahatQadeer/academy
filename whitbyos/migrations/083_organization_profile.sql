-- =====================================================================
-- Whitby — the organization's own profile
-- Owner: Sabahat (whitbyos_*)
--
-- Everything Whitby knows about a client, it now knows in detail; everything
-- it knows about the firm doing the work was a name, a logo and a timezone.
-- These are the firm's own professional details, the part of them a client is
-- allowed to see, the terms an engagement starts from, and what an hour of the
-- firm's time costs internally.
--
-- On `whitbyos_workspace_settings` rather than on the shared `workspaces`
-- table, for the reason 003 gives: these steer Whitby and must not leak into
-- how the other modules read a workspace.
--
-- The internal rate is money and so is stored in minor units, like every other
-- amount in this schema. It is internal: it is what the firm books time at,
-- never something the Client Portal reads.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_workspace_settings
  -- Detailed professional information.
  add column if not exists legal_name text,
  add column if not exists practice_type text,
  add column if not exists registration_number text,
  add column if not exists tax_id text,
  add column if not exists founded_year integer,
  add column if not exists professional_email text,
  add column if not exists professional_phone text,
  add column if not exists office_address text,
  add column if not exists service_areas text,

  -- Public, contract and ranking information.
  add column if not exists public_profile_url text,
  add column if not exists public_summary text,
  add column if not exists standard_contract_terms text,
  add column if not exists notice_period text,
  add column if not exists ranking text,
  add column if not exists accreditations text,

  -- Internal billing rate.
  add column if not exists internal_rate_cents integer,
  add column if not exists internal_rate_unit text,
  add column if not exists internal_rate_note text;

-- A year somebody can defend, rather than 20255.
alter table public.whitbyos_workspace_settings
  drop constraint if exists whitbyos_workspace_settings_founded_year_check;

alter table public.whitbyos_workspace_settings
  add constraint whitbyos_workspace_settings_founded_year_check
  check (founded_year is null or (founded_year between 1800 and 2200));

-- Rates are per something, and the something is one of these.
alter table public.whitbyos_workspace_settings
  drop constraint if exists whitbyos_workspace_settings_internal_rate_unit_check;

alter table public.whitbyos_workspace_settings
  add constraint whitbyos_workspace_settings_internal_rate_unit_check
  check (
    internal_rate_unit is null
    or internal_rate_unit in ('hour', 'day', 'week', 'month', 'engagement')
  );

-- Never negative, and never a rate with no unit to read it by.
alter table public.whitbyos_workspace_settings
  drop constraint if exists whitbyos_workspace_settings_internal_rate_check;

alter table public.whitbyos_workspace_settings
  add constraint whitbyos_workspace_settings_internal_rate_check
  check (
    internal_rate_cents is null
    or (internal_rate_cents >= 0 and internal_rate_unit is not null)
  );


-- =====================================================================
-- VERIFY — should return 18 rows.
-- =====================================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_workspace_settings'
--   and column_name in (
--     'legal_name','practice_type','registration_number','tax_id',
--     'founded_year','professional_email','professional_phone',
--     'office_address','service_areas','public_profile_url','public_summary',
--     'standard_contract_terms','notice_period','ranking','accreditations',
--     'internal_rate_cents','internal_rate_unit','internal_rate_note'
--   )
-- order by column_name;
