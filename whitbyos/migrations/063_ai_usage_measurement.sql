-- 063 — what the model actually did, at a precision a single call fits into.
--
-- 062 added `cost_cents` for the measured LLM cost. Measuring it revealed that
-- the unit is wrong: one drafting call is a few thousand tokens, which at any
-- plausible token rate costs a fraction of a penny. In whole cents every
-- generation rounds to 0, and the sum of a month of them is 0 too. An integer
-- cent cannot hold this, so the money here is kept in micro-dollars.
--
--   1 USD = 1,000,000 micros.  1 cent = 10,000 micros.
--
-- Integers throughout, so no float ever touches a charge.
--
-- WHY A METER STATE TABLE
-- The Stripe meter bills $0.01 per unit and the handover says to report
-- customer-facing cents. A generation worth 0.09 of a cent cannot be reported
-- as an integer number of cents on its own, and rounding each one up to 1 would
-- overcharge by more than ten times. So charges accumulate in micros and only
-- whole cents are ever reported; `whitbyos_ai_meter_state` remembers how many
-- cents a workspace has already been billed, and each run reports the
-- difference. That makes a repeated run report nothing rather than double.
--
-- Deliberately NOT here: any per-plan allowance, and any token price. Google's
-- rates are not in this project and are not invented; `cost_micros` stays null
-- until they are configured, and a null cost reports nothing.
--
-- Re-runnable: `add column if not exists`, `create table if not exists`, policy
-- dropped by name. One transaction.

begin;

alter table public.whitbyos_ai_usage
  -- The measurement. Null on a row from before this, or when the model
  -- returned no usage block.
  add column if not exists model text,
  add column if not exists prompt_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists total_tokens integer,
  -- The money, in micro-dollars. Null while token pricing is unconfigured:
  -- a zero would claim the call was free rather than admit it was not priced.
  add column if not exists cost_micros bigint,
  add column if not exists profit_micros bigint,
  add column if not exists charge_micros bigint;

comment on column public.whitbyos_ai_usage.cost_micros is
  'Actual LLM cost in micro-dollars (1e-6 USD). The measured figure everything else derives from.';

comment on column public.whitbyos_ai_usage.profit_micros is
  'Margin in micro-dollars: round(cost_micros * markup_rate).';

comment on column public.whitbyos_ai_usage.charge_micros is
  'Customer charge in micro-dollars: cost_micros + profit_micros.';

comment on column public.whitbyos_ai_usage.units is
  'Whole cents reported to the Stripe meter for this row. Usually 0: one call is worth less than a cent, and cents are reported once they accumulate.';

create table if not exists public.whitbyos_ai_meter_state (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  -- Cumulative whole cents already sent to the meter. The next run reports
  -- (owed - reported), so running twice reports nothing the second time.
  reported_cents bigint not null default 0,
  last_reported_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.whitbyos_ai_meter_state enable row level security;

drop policy if exists whitbyos_ai_meter_state_read on public.whitbyos_ai_meter_state;
create policy whitbyos_ai_meter_state_read on public.whitbyos_ai_meter_state
  for select using (public.is_workspace_member(workspace_id));

commit;
