-- Partner Center Stripe Connect — owner: Zara (prefix partner_)
--
-- Stores the Express connected-account id on the partner profile (status /
-- reference only — never bank or tax identity). Webhook event ids support
-- idempotent Connect account sync (SRS §17.15.3).

alter table public.partner_profiles
  add column if not exists stripe_connect_account_id text;

create unique index if not exists partner_profiles_stripe_connect_account_id_uidx
  on public.partner_profiles (stripe_connect_account_id)
  where stripe_connect_account_id is not null;

create table if not exists public.partner_stripe_webhook_events (
  id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.partner_stripe_webhook_events enable row level security;
-- No policies: only the service role (webhook handler) can read/write.
