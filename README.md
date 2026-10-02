     # Private Attach├⌐ System  ....
...
One Next.js app, one Vercel project, one Supabase project. Four products behind a shared identity and a product switcher.

**Private Attach├⌐** is the master brand and app shell. **Whitby** is the intelligent coordination layer inside it. Do not label any screen "Whitby OS".

## Folder structure
 
`/base` is the shared platform. Each product is its own top-level folder. `/app` is routing glue only.

```
/base              shared platform ΓÇö auth, identity, switcher, UI
/whitbyos          Sabahat ΓÇö Whitby
/client-portal     Rohail
/academy           Rahat ΓÇö Academy + LMS
/partner-center    Zara
/app               Next.js routes (do not put product features here)
/docs              SRS, design system, DB schema
/supabase          shared schema
```

Each product folder has `cursor.md`, `page.tsx`, and `nav.ts`. Open that folder and start. Add `components/` or extra screens in your folder when you need them.

When you add a real screen (example: Whitby Clients):

1. Create `whitbyos/clients/page.tsx`
2. Create `app/whitbyos/clients/page.tsx` with `export { default } from "@/whitbyos/clients/page";`
3. The item in `nav.ts` already points at `/whitbyos/clients`

Until then, every nav path stays on the placeholder so nothing 404s.

## Stack

- Next.js App Router on Vercel
- Supabase Auth, Postgres, Storage
- Shared design system and canonical tables in `/base`

## Git workflow

```bash
git clone https://github.com/righttailorg-2/Private-Attache-System.git
cd Private-Attache-System
git checkout base
git checkout -b <name>/<module>
```

Examples:

- `sabahat/whitbyos`
- `rohail/client-portal`
- `rahat/academy-lms`
- `zara/partner-center`

Work only inside your assigned product folder. Do not modify another person's folder or `/base` without coordinating. Open a PR against `base`, not `main`. `main` stays untouched until base is verified.

Set the Vercel production branch to **`base`** until this phase is verified. Preview deployments still spin up from every PR.

## Who owns what

| Person | Folder | Tables |
|---|---|---|
| Laiba | `/base` | `users`, `workspaces`, `workspace_members`, `entitlements`, `invitations`, `contacts`, `contact_roles`, `companies`, `company_contacts`, `documents`, `document_labels`, `audit_log`, `taxonomy_*` |
| Sabahat | `/whitbyos` | `whitbyos_*` |
| Rohail | `/client-portal` | `client_portal_access_requests`, `client_portal_notification_prefs` only. Everything else is `whitbyos_*` through the permission layer. Never create `client_portal_requests` or `client_portal_documents`. |
| Rahat | `/academy` | `academy_*` (Academy + LMS, one schema) |
| Zara | `/partner-center` | `partner_*` |

Import UI and types from `@/base/components` and `@/base/types`. Each product folder has a `cursor.md` ΓÇö open Cursor there and start.

## Team dependency map

- **Sabahat Γåö Rohail (daily):** the Client Portal is a permission-scoped layer on Sabahat's `whitbyos_*` tables. Schema changes to Requests, Forms, Documents, or Messages need to be communicated before they ship.
- **Sabahat Γåö Zara (schema):** Partner profiles sit on base `contacts` / `companies`. Confirm those fields before Zara builds on top.
- **Zara Γåö Sabahat + Rahat (events):** Partner attribution needs a product-qualifying action from Whitby (Stripe subscription activation) and from Academy (course enrollment). Agree the payload shape early.
- **Rahat Γåö Sabahat (one hand-off):** Academy Training Workspace provisions a restricted Whitby workspace with a 90-day expiry.
- **Everyone Γåö Laiba:** new shared fields on `users`, `contacts`, `companies`, or `documents` are requested from base. Do not add a local duplicate column.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the one shared Supabase project (URL, anon key, service role). Set the same three values once on the Vercel project ΓÇö never per module.
2. Enable Email and Google providers in Supabase Auth. Set Site URL to `https://private-attache-dun.vercel.app` and Redirect URLs to:
   - `https://private-attache-dun.vercel.app/**`
   - `https://private-attache-dun.vercel.app/auth/callback`
   - `https://private-attache-dun.vercel.app/auth/callback?next=/confirmed`
3. Push schema:

```bash
npx supabase db push
```

4. Install and run:

```bash
npm install
npm run dev
```

5. Sign up ΓåÆ check-email screen ΓåÆ confirm from the inbox ΓåÆ account-confirmed screen ΓåÆ switcher ΓåÆ open a placeholder product. The PA + workspace name control in the upper left opens the product switcher.

6. **Super Admin (staff):** apply migrations through `00045`, set `SUPER_ADMIN_SESSION_SECRET` (min 32 chars, e.g. `openssl rand -base64 48`), then in SQL Editor:
   `select public.upsert_super_admin('you@example.com', 'your-long-password');`
   (password ΓëÑ 12 characters). Sign in at `/super-admin/signin`. No product Auth account. Sessions are 2h, SameSite=Lax, with login lockout after 5 failures / 15 minutes.


## Routes

| Path | Purpose |
|---|---|
| `/` | Marketing landing |
| `/signup` `/login` `/forgot-password` `/reset-password` | Shared auth |
| `/check-email` | After sign-up: we sent a confirmation link |
| `/confirmed` | After the email link: account is confirmed |
| `/invite/[token]` | Generic invitation accept |
| `/onboarding/*` | Professional workspace onboarding |
| `/switcher` | Post-login product picker (multi-entitlement) |
| `/whitbyos` | Whitby ΓÇö Sabahat |
| `/client-portal` | Client Portal ΓÇö Rohail |
| `/academy` | Academy + LMS ΓÇö Rahat |
| `/partner-center` | Partner Center ΓÇö Zara |

## Switcher rules

- After login, more than one active entitlement ΓåÆ `/switcher`. Exactly one ΓåÆ route directly there.
- Inside any product, the top-left control (PA mark + workspace name) opens the four-product dropdown: Whitby, Client Portal, Academy, Partner Center. `+ Add workspace` goes to onboarding.
- Zero-entitlement products: `NEXT_PUBLIC_SWITCHER_UNENTITLED=grey` (default, muted card + apply/explore) or `hide`. Do not hard-code this.

## Source documents

- `docs/Private-Attache-Ecosystem-SRS-v3.md`
- `docs/design-system.md`
- `docs/DB-Schema.md`
- `base/cursor.md`

## Open items (flagged, not silently resolved)

1. Zero-entitlement switcher behavior (mechanism supports both).
2. Default landing rules per role (`entitlements.is_default_landing` exists; business rules TBD).
3. Exact role vocabulary per module (Whitby starting list is Owner, Admin, Team Lead, Coordinator, Billing, Viewer).
4. Academy and LMS live in one folder (`/academy`) as recommended.
# academy
