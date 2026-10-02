-- 058 — somewhere for Stripe to write.
--
-- The Whitby catalogue, meter and webhook are set up on the shared Right Tail
-- test account. The webhook has had nowhere to put what it hears: workspaces
-- carried `plan` and `trial_ends_at` and nothing else, and no table recorded
-- that an event had been handled.
--
-- Three things:
--
-- 1. The Stripe side of a workspace's subscription, on `workspaces`, because
--    that is the thing being subscribed and every screen already reads it.
-- 2. `whitbyos_billing_events`, keyed on Stripe's own event id. Stripe retries
--    an event until it is acknowledged and can deliver the same one twice, so
--    the id is the primary key and a second delivery is a no-op rather than a
--    second upgrade.
-- 3. `whitbyos_ai_usage`, one row per reported unit. The meter is Sum over
--    `ai_usage`, and reporting to Stripe is a network call that can fail, so
--    what was reported is written here first and `reported_at` marks the ones
--    that made it.

alter table public.workspaces
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists plan_price_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

create unique index if not exists workspaces_stripe_customer_idx
  on public.workspaces (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.whitbyos_billing_events (
  -- Stripe's event id, so a redelivery collides instead of repeating.
  id text primary key,
  type text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  payload jsonb,
  received_at timestamptz not null default now(),
  handled_at timestamptz,
  error text
);

create index if not exists whitbyos_billing_events_workspace_idx
  on public.whitbyos_billing_events (workspace_id, received_at desc);

create table if not exists public.whitbyos_ai_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- What was charged for, in the customer-facing cents the meter expects.
  units integer not null,
  feature text,
  occurred_at timestamptz not null default now(),
  reported_at timestamptz,
  stripe_event_id text
);

create index if not exists whitbyos_ai_usage_workspace_idx
  on public.whitbyos_ai_usage (workspace_id, occurred_at desc);

create index if not exists whitbyos_ai_usage_unreported_idx
  on public.whitbyos_ai_usage (occurred_at)
  where reported_at is null;

-- RLS. Billing events and usage are written by the webhook and by server
-- actions holding the service key; a workspace member may read their own.
alter table public.whitbyos_billing_events enable row level security;
alter table public.whitbyos_ai_usage enable row level security;

drop policy if exists whitbyos_billing_events_read on public.whitbyos_billing_events;
create policy whitbyos_billing_events_read on public.whitbyos_billing_events
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists whitbyos_ai_usage_read on public.whitbyos_ai_usage;
create policy whitbyos_ai_usage_read on public.whitbyos_ai_usage
  for select using (public.is_workspace_member(workspace_id));

-- Added while verifying end to end: 17.4 prints a start date, and nothing was
-- recording when the subscription began.
alter table public.workspaces
  add column if not exists subscription_started_at timestamptz;
