-- 4.3 — Onboarding Step 4/5, "Choose your plan", which the workspace had
-- nowhere to remember.
--
-- Five plans exist in the product now (Pricing & Categories 8-25-26), and the
-- onboarding step that asks somebody to pick one had no column to write the
-- answer into. Everything downstream of the choice needs it: 4.35 locks the
-- team step below Teams, 0.9 counts active Client Workspaces against the plan's
-- limit, and Settings → Billing reads the current plan back.
--
-- `plan` is text rather than an enum. The five are not a closed set — Enterprise
-- is quoted by hand and its limits are agreed per contract — and the pricing
-- document asks for all limits to be admin-configurable rather than fixed in
-- the schema. Text keeps that possible without a migration for every change.
--
-- The default is the trial, because that is where every new workspace starts:
-- 4.3 says "You're starting on the 14-Day Free Trial."
--
-- `trial_ends_at` is nullable and set when the trial begins. Nothing enforces
-- it yet — there is no billing connected to enforce it with — but the date has
-- to be recorded at the moment it starts, not worked out afterwards from a
-- created_at that may have moved.
--
-- Deliberately NOT added here: stripe_customer_id, stripe_subscription_id,
-- renewal_at. Those belong with the Stripe work, and a column nothing can write
-- is a column that gets read as though it means something.

alter table public.workspaces
  add column if not exists plan text not null default 'trial';

alter table public.workspaces
  add column if not exists trial_ends_at timestamptz;
