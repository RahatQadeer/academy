# Partner attribution — integration handoffs

Cross-module callers record qualifying actions through the attribution service or HTTP API.

## HTTP API (manual / test / external)

`POST /api/partner-center/attribution`

Header: `Authorization: Bearer ${PARTNER_ATTRIBUTION_SECRET}`

```json
{
  "referredUserId": "uuid",
  "product": "academy",
  "qualifyingAction": "paid_enrollment",
  "commissionable": true,
  "eventSource": "stripe",
  "externalPaymentId": "pi_xxx",
  "productId": "program-uuid",
  "amountCollectedCents": 9900
}
```

`amountCollectedCents` is persisted on the attribution event and used for proportional refund reversals.

## Server import (preferred in-app)

```typescript
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { recordQualifyingAction } from "@/partner-center/lib/attribution";

const admin = createAdminClient();
if (admin) {
  await recordQualifyingAction(admin, { ... });
}
```

## Stripe refund / chargeback reversal

Platform webhook (customer payments — not Connect payout events):

`POST /api/partner-center/stripe/collections/webhook`

Events: `charge.succeeded`, `charge.refunded`, `charge.dispute.closed` (when status is `lost`).

### Enterprise opportunity payment (SRS §17.6.11, §17.7.9)

**Primary path — admin Record payment:** Super Admin → Opportunities → detail → choose source (`stripe` | `quickbooks`), enter external payment id and collected amount. Calls `recordOpportunityPayment`, which writes `partner_attribution_events` with `opportunity_id` and creates an enterprise earning (15% default on collected amount). QuickBooks ids are stored as `qbo_payment_<id>`.

**Automatic path — Stripe `charge.succeeded`:** Same collections webhook endpoint. Matches payment to opportunity when:

1. Charge metadata includes `partner_opportunity_id` (optional convenience), or
2. Billing email matches exactly one eligible opportunity primary contact (status `accepted` / `in_progress` / `converted`, within `protected_until`).

If no match, admin uses Record payment (SRS §17.5.17 manual correction).

**Automatic path — QuickBooks Payment (§17.15.4–5):**

- OAuth: `GET /api/partner-center/quickbooks/start` → Intuit → `GET /api/partner-center/quickbooks/callback` (stores `realm_id` + tokens in `partner_integration_credentials`).
- Connect UI: Super Admin → Program config → Connect QuickBooks.
- Webhook: `POST /api/partner-center/quickbooks/webhook` (HMAC via `INTUIT_WEBHOOK_VERIFIER_TOKEN`; idempotency in `partner_qb_webhook_events`).
- Handler loads Payment → linked Invoice → Customer, skips Stripe-synced lineage when notes/refs contain `pi_` / `ch_` (or the Stripe id is already attributed), then `resolveOpportunityForPayment` + `recordOpportunityPayment({ eventSource: "quickbooks" })`.
- Unmatched payments create a staff `payment_unmatched` admin notification.

Dedup: unique on `(partner_profile_id, external_payment_id)` (SRS §17.7.11).

### Refund / chargeback reversal

Looks up `partner_earnings` by `collected_payment_ref` (typically `pi_xxx`), writes `partner_earning_adjustments`, and sets `reversed` when the earning is unpaid and fully refunded.

Locally:

```bash
stripe listen --forward-to localhost:3000/api/partner-center/stripe/collections/webhook
```

Register `charge.succeeded` alongside refund events on the platform webhook.

## Payout run (manual MVP)

`POST /api/partner-center/payouts/run`

Header: `Authorization: Bearer ${PARTNER_PAYOUT_SECRET}`

```json
{ "partnerProfileId": "uuid" }
```

Promotes approved → payable when eligible, nets pending clawback adjustments, then batches Stripe Connect transfer.

## Academy (Rahat's module)

Academy must call `POST /api/partner-center/attribution` — do not import
partner-center code from `/academy`. Wired via
`academy/lib/notifyPartnerAttribution.ts` from free enrollment and paid
checkout fulfill.

Free enrollment: `commissionable: false`, `qualifyingAction: "free_enrollment"`.
Paid enrollment: `commissionable: true`, `qualifyingAction: "paid_enrollment"`,
`eventSource: "stripe"`, plus `amountCollectedCents` and Stripe payment id.

## Platform / Whitby (Sabahat's module)

Whitby billing webhook `invoice.paid` with `billing_reason=subscription_create`
and `amount_paid > 0` calls the same API via
`whitbyos/lib/stripe/notifyPartnerAttribution.ts`
(`qualifyingAction: "first_paid_subscription"`).

## New-customer waiting period (SRS §17.1.12)

Configurable 30/60/90 via commission rule `eligible_revenue_rules`:
`{ "new_customer_period_days": 60 }` (default 60). Earnings created during the
period are `held` until the period elapses, then promoted to `pending` /
`approved` on payout promotion runs.

## Earning status path (SRS §17.7.7)

`held` (waiting period, §17.1.12) → `pending` → `approved` (system, when payable_date /
hold elapsed) → `payable` (tax+payout gate) → `paid`. Exception: `ineligible`
when basis/period/revenue rules forbid commission. No Super Admin click-per-earning.

**Assumed default (not in SRS):** `payout_locked` is a transient in-flight payout
batch lock (`payable` → `payout_locked` → `paid`, or back to `payable` on failure).
It is distinct from `held` so waiting-period release never touches a payout batch.

**Assumed ops default (not in SRS):** nightly cron `GET /api/cron/partner-earnings-promote`
(`CRON_SECRET`) advances held/pending/approved → payable without waiting for a new sale
or admin payout click.

## First-touch + FirstPromoter (SRS §17.14.5 / §17.15.6)

Platform config `attribution_mode` defaults to `first_touch`: cookie capture and
identity attribution keep the first partner. FirstPromoter is optional:

- Enable + account ID under Super Admin → Program config → Attribution
- Map `promoter_id` on Partner → Edit programs & terms
- Outbound: `FIRSTPROMOTER_API_KEY` → track/signup and track/sale
- Inbound: `POST /api/partner-center/firstpromoter/webhook` with
  `Authorization: Bearer ${FIRSTPROMOTER_WEBHOOK_SECRET}` (or API key)
- Whitby remains SoR for earnings; FP never creates `partner_earnings` alone

## Env

- `PARTNER_ATTRIBUTION_SECRET` — required on **every** deploy that calls attribution (Academy on `private-attache-dun`, Whitby on `private-attache-system`) **and** on the host that serves `/api/partner-center/attribution`
- `PARTNER_PAYOUT_SECRET` (optional; can match attribution secret in dev)
- `NEXT_PUBLIC_SITE_URL` — Academy notifier POSTs to `{SITE_URL}/api/partner-center/attribution`
- `STRIPE_WEBHOOK_SECRET` — Connect webhook (`account.*`, `transfer.reversed`, `transfer.updated`)
- `STRIPE_COLLECTIONS_WEBHOOK_SECRET` — platform collections webhook (falls back to `STRIPE_WEBHOOK_SECRET` in dev)
- `STRIPE_ACADEMY_WEBHOOK_SECRET` / `STRIPE_WHITBY_WEBHOOK_SECRET` — must match each Stripe destination’s signing secret on the matching Vercel project
- `INTUIT_CLIENT_ID` / `INTUIT_CLIENT_SECRET` / `INTUIT_WEBHOOK_VERIFIER_TOKEN` — QuickBooks Online platform connect + webhooks (`INTUIT_ENVIRONMENT=sandbox|production`)
- `FIRSTPROMOTER_API_KEY` / `FIRSTPROMOTER_WEBHOOK_SECRET` — optional FirstPromoter track API + webhook auth

### Expire open referrals (optional cron)

`POST /api/partner-center/referrals/expire`

Header: `Authorization: Bearer ${PARTNER_ATTRIBUTION_SECRET}`

Partner list load and Super Admin list also close expired rows scoped/cheaply; cron is optional for nightly cleanup.
