-- 062 — record what the AI actually cost us, not only what we charge for it.
--
-- The client settled the model on 2026-09-08: we bill the actual LLM cost plus
-- a markup, where the profit is half the cost. £100 of model time is charged at
-- £150. Cost x 1.5, arrived at as cost + (cost / 2).
--
-- `whitbyos_ai_usage` already carries `units`, the customer-facing figure the
-- Stripe meter sums. That is the *output* of the calculation. Nothing recorded
-- the two inputs, so a charge could never be checked, re-derived, or explained
-- to a customer who asked how a number was reached.
--
-- Two columns fix that:
--
--   `cost_cents`   what the model call actually cost us. This is the figure the
--                  whole model rests on and the only one that is measured
--                  rather than derived.
--
--   `markup_rate`  the rate applied *to this row*, not to the account. The rate
--                  is configuration and will change; a row priced under the old
--                  rate has to keep saying so, or every historical charge
--                  silently re-prices itself the day the number moves.
--
-- `units` stays the charged amount, so nothing that reports to Stripe changes.
-- The invariant is: units = cost_cents + round(cost_cents * markup_rate).
--
-- Deliberately NOT here: any per-plan allowance. There is none, none is
-- decided, and inventing a plausible one would be charged to somebody.
--
-- Re-runnable: `add column if not exists`, and one transaction.

begin;

alter table public.whitbyos_ai_usage
  -- Nullable: rows written before this migration recorded no cost, and a zero
  -- would claim the call was free rather than admit it was never measured.
  add column if not exists cost_cents integer,
  add column if not exists markup_rate numeric(6, 4);

comment on column public.whitbyos_ai_usage.cost_cents is
  'What this generation actually cost us, in cents. The measured input to the charge.';

comment on column public.whitbyos_ai_usage.markup_rate is
  'The markup applied to this row when it was written, so an old charge is not re-priced when the rate changes.';

comment on column public.whitbyos_ai_usage.units is
  'What the customer is charged, in cents: cost_cents + round(cost_cents * markup_rate). Summed by the Stripe meter.';

commit;
