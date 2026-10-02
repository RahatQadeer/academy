# Cursor Project Context — Partner Center Module
### Owner: Zara

Read `PartnerCenter-Requirements.md` (Parts A, B, C) before generating any
code — a dedicated combined requirements + database doc for this module
(matching Sabahat's `Sabahat-WhitbyOS-Requirements.md`) is still pending
and will replace this pointer once built; until then this doc is current
and accurate. Also read `design-system.md` and `DB-Schema.md` (both in
repo root, pulled from `base`) before writing any UI or migration code.
This file is build-order + engineering-discipline guidance on top of all
three, not a replacement for any of them.

---

## 1. Project Context — Read This First

You (Cursor) are working on **one module** — Partner Center — inside a larger
multi-module ecosystem called Private Attaché / Whitby. The other modules are:

- **WhitbyOS** (professional operating platform) — owned by Sabahat
- **Client Portal** — owned by Rohail
- **Academy + LMS** — owned by Rahat
- **Base platform** (shared auth/identity, module switcher, repo skeleton) — owned by Laiba

These modules **will be connected later** into one repo/deployment via the shared
base. Partner Center is unusually cross-module-dependent: its core mechanism
(single-link, multi-product attribution — requirements doc Part A.4) only works
if Academy, WhitbyOS, and Enterprise all emit qualifying-action events back to
this module. Build with that integration in mind from day one — define the
`AttributionEvent` contract clearly and treat it as a public interface other
modules will call into, not an internal implementation detail.

Do not build sign-up, login, or forgot-password — those live in the shared base.
Clone the repo only after Laiba pushes the base, then create your branch from
that commit and work inside your module folder only.

Never add a `Co-Authored-By` trailer to commits.

---

## 2. Code Architecture Rules (apply to every file you generate, every time)

- **Small, focused files.** No file should grow into a monolith. If a component,
  page, or utility file is approaching a few hundred lines, split it — this is
  a hard rule. Never let a single file reach thousands of lines.
- **Split by responsibility, not by convenience.** A page like Commission
  Detail or the Referral Links breakdown should be composed of small
  subcomponents (`KpiCardRow`, `ReferralTable`, `AttributionBreakdown`,
  `CommissionStatusBadge`, etc.) in their own files, not one giant page file.
- **Consistent folder structure.** Group by feature (`/partner-center/dashboard`,
  `/partner-center/referrals`, `/partner-center/commissions`, etc.), and within
  each separate `components/`, `hooks/`, `types/`, `utils/`.
- **Reusable UI goes in a shared component layer** inside this module — don't
  duplicate the same status badge, KPI card, or table across pages.
- **Types/interfaces are shared and explicit.** `Partner`, `Referral`,
  `AttributionEvent`, `CommissionProgram`, `Commission` — define these once in
  a central types file, import everywhere. The `AttributionEvent` shape in
  particular should be treated as a stable contract since other modules will
  eventually produce these events.
- **No silent scope creep.** If a requirement isn't in Part A and isn't
  explicitly flagged in Part B/C, don't invent it — flag it back instead of
  guessing.
- Repeat before every significant file: **clean, small, structured,
  componentized. Never one giant file.**

### Typography (Partner Center + Super Admin PC)

Use the locked scale in `partner-center/lib/typography.ts` (`pcType`).
Super Admin re-exports the same map from
`super-admin/partner-center/lib/typography.ts`. Do **not** invent new
`text-[Npx]` steps.

| Role | Size | Use |
|---|---|---|
| display | 24px | Rare status/hero |
| page | 18→20px | Shell / pane page title |
| title | 16px | Section / thread / card title |
| subtitle | 13px | Supporting line under a title |
| body / bodyStrong | 13.5px | Default UI copy |
| control | 14 / 14.5px | Buttons, inputs, chips |
| label | 12.5px | Form labels, captions |
| meta | 11.5px | Timestamps, helper counts |
| micro | 10.5px | Pills, bubble meta |

Hierarchy: page > title > body > meta > micro.

## 3. Confirmed Stack
Next.js (App Router) hosted on Vercel. Supabase for Postgres and
row-level security, scoped to `partner_profiles` and its related tables.
Webhook/event listeners for cross-module attribution events (Section 4)
should be implemented as Next.js API routes or Vercel Edge Functions,
verified against Stripe/QuickBooks signatures before writing an
`partner_attribution_events` row. Stripe Connect handles partner payouts
directly per the requirements doc — do not store raw bank/tax data in
Supabase, only status/reference fields.

## 4. Folder / Page Build Order

1. **Referral Links + Attribution model** — build this first, everything else
   reads from it (single link/code generation, click capture, Referral +
   AttributionEvent data model — requirements doc Part A.4)
2. **Dashboard** — KPI cards, Recent Referrals, 3 Partner Program cards
3. **Referrals** — list, status filter (Pending/Approved/Paid/Reversed —
   confirm whether to add Ineligible), product filter, sort by date
4. **Commissions** — status-grouped list + Commission Detail view
5. **Programs** — 3 program configs (Academy/WhitbyOS/Enterprise) with
   eligibility/commission/attribution rules — Commissions reads against this
6. **Documents** — Partner Agreement, Program Terms (view/download PDF)
7. **Messages** — program support chat, same pattern as other modules
8. **Settings (avatar)** — Profile, Notifications, Security. Tax/Payment,
   Company & Team, and Agreements stay on their own surfaces.

> **Payouts is flagged as a required but not-yet-designed feature** (requirements
> doc Part B.6 / Part C item 6) — don't skip it entirely; check with the client
> before this module is considered complete, since partners can't actually get
> paid without it.

## 5. Data Model Notes — Attribution (Critical, Build First)

- `Partner` — one record per partner, exactly **one** `referral_code`.
- `ReferralClick` — code + timestamp + attribution-window expiry on link click.
- `Referral` — created at signup if a captured `referral_code` is present;
  status starts as `referred_product_pending`.
- `AttributionEvent` — created when the referred identity performs a
  product-qualifying action in any module:
  `{ partner_id, referred_user_id, product: 'academy' | 'whitbyos' | 'enterprise', qualifying_action, timestamp, referral_code }`
  One referred user can generate multiple events over time.
- `CommissionProgram` — config per product: percentage/fixed amount, eligible
  revenue basis, eligible period, attribution window, included/excluded
  charges, refund/chargeback treatment, payment timing, partner tier,
  effective/end dates, approval requirements.
- `Commission` — instantiated from an `AttributionEvent` + matching
  `CommissionProgram`, status: pending → approved → paid, or reversed.
- `Payout` — **not yet fully specced** (flagged); at minimum expect
  `partner_id, amount, status, scheduled_date, paid_date, payment_method,
  tax_status`. Confirm shape before building the UI.

**You will need listeners/webhooks from the other modules** to fire qualifying
actions:
- Academy → course enrollment event (confirm with Rahat: free or paid-only)
- WhitbyOS → Stripe subscription-activated event (confirm with Sabahat/Laiba)
- Enterprise → seat-assignment event (owner TBD — flagged in requirements doc
  Part B.10 as an unassigned internal admin surface)

## 5b. Stripe Connect (Partner payouts)

Express-style **Accounts v2** recipient onboarding (not Accounts v1
`type: express`). Creates via `POST /v2/core/accounts` with
`configuration.recipient` + `stripe_balance.stripe_transfers`, then hosted
Account Links via `v2.core.accountLinks`.

Lives in Settings → Tax (and checklist payout).
Env: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`. Apply migration `00033_partner_stripe_connect.sql`.

Webhook (test or live): `POST /api/partner-center/stripe/webhook` — events
`account.updated`, `account.application.deauthorized`, `transfer.reversed`,
`transfer.updated`. Locally use Stripe CLI:
`stripe listen --forward-to localhost:3000/api/partner-center/stripe/webhook`
and put the printed `whsec_…` in `.env.local`.

## 5c. Attribution + payouts (referral engine)

See [`lib/attribution/INTEGRATION.md`](lib/attribution/INTEGRATION.md).

Env: `PARTNER_ATTRIBUTION_SECRET`, `PARTNER_PAYOUT_SECRET` (payout route falls
back to attribution secret when payout secret is unset).

## 6. Explicitly Out of Scope for This Module
- WhitbyOS, Client Portal, Academy/LMS — separate modules.
- External affiliate-platform integration (FirstPromoter/Rewardful/PartnerStack)
  — not used; attribution is first-party.
- Internal Partner Administration (admin-side config of partner types, tiers,
  commission rules) — not assigned to this module yet, do not build without
  confirmation (requirements doc Part B.10).
- **SRS §17.9 multi-link Links & Codes** — confirmed decision: keep the **one**
  existing referral link only. Do not build Program Links, Access Codes, or
  Campaign/Event surfaces. Do not flag those as gaps in audits.

## 7. Known Open Questions — Do Not Silently Resolve, Flag in PR
See requirements doc Part C, items 1–12. Item 3 (qualifying action per
product) blocks the Attribution model — get this confirmed before building
webhooks. Item 6 (Payouts) blocks considering this module launch-ready.
