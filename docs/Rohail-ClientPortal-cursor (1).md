Main Guide:
4 products: Whitby, Client Portal, Academy, Partner Centre.
Private Attaché = overall app/brand; Whitby = professional product.
Sabahat → /whitbyos
Rohail → /client-portal
Rahat → /academy
Zara → /partner-center
Work only on your own branch and product folder. Don’t edit /base or another product without coordinating.
Pull from base before starting. Open PRs against base, not main.
Read the relevant docs/MD files in /docs first, especially the SRS and DB information.
No DB changes on the first pass. Check the existing schema/migrations and reuse what already exists. Ask before making DB changes if something is genuinely missing.
Reuse the existing shared auth. Don’t create another login system.
After the switcher, build product-specific auth/onboarding inside your own product folder.
Reuse @/base/components. If something is missing, create it in your product’s components/ folder. Move to /base only if it truly needs to be shared.
/app is for routing/auth glue only. Product screens belong in their product folder.
Don’t duplicate shared data/tables such as users, contacts, companies, or documents.
Follow the existing design system and tokens. Don’t introduce random colors, fonts, or branding.

Main rule: Check the docs and existing code first, reuse what’s already built, don’t change the DB on the first pass, and build auth + onboarding in your own branch/folder. 

# Cursor Project Context — Client Portal Module
### Owner: Rohail

Read `WhitbyOS-ClientPortal-Requirements.md` (Parts A, B.2, C) before
generating any code — your dedicated combined requirements + database doc
(matching the detail level of Sabahat's `Sabahat-WhitbyOS-Requirements.md`)
is still pending and will replace this pointer once built; until then this
shared doc is current and accurate for your module. Also read
`design-system.md` and `DB-Schema.md` (both in repo root, pulled from
`base`) before writing any UI or query code. This file is build-order +
engineering-discipline guidance on top of all three, not a replacement for
any of them.

---

## 1. Project Context — Read This First

You (Cursor) are working on **one module** — Client Portal — inside a larger
multi-module ecosystem called Private Attaché / Whitby. The other modules are:

- **WhitbyOS** (professional platform) — owned by Sabahat. This module **owns**
  the Request, Forms, Documents, Messages, and Billing data your module reads.
  You are largely a read/limited-write view on records Sabahat's module owns
  — coordinate before assuming a data shape.
- **Academy + LMS** — owned by Rahat
- **Partner Center** — owned by Zara
- **Base platform** (shared auth/identity, module switcher, repo skeleton) — owned by Laiba

These modules **will be connected later** into one repo/deployment via the
shared base. Do not build sign-up or login — clients authenticate via
invitation only (accept invite → read-only email → set password), which lives
in the shared base. Your module picks up **after** the client has a password
set. Clone the repo only after Laiba pushes the base, then create your branch
from that commit and work inside your module folder only.

---

## 2. Code Architecture Rules (apply to every file you generate, every time)

- **Small, focused files.** No file should grow into a monolith. If a
  component, page, or utility file is approaching a few hundred lines, split
  it — this is a hard rule. Never let a single file reach thousands of lines.
- **Split by responsibility, not by convenience.** The Requests page is a
  shell + separate components for the list, the "Submit a New Request"
  inline form, and the Current/Closed sections — not one file. Same pattern
  for Documents (Requested From You vs. Shared With You as separate
  subcomponents), Billing (KPI row, Pay button, Invoice History table), etc.
- **Consistent folder structure.** Group by feature (`/client-portal/home`,
  `/client-portal/requests`, `/client-portal/tasks`, etc.), and within each
  separate `components/`, `hooks/`, `types/`, `utils/`.
- **Reusable UI goes in a shared component layer** inside this module — the
  Messages thread UI, status badges, KPI cards should not be duplicated
  across Home/Requests/Billing.
- **Types/interfaces are shared and explicit.** Since you consume WhitbyOS's
  data models (`Request`, `Form`, `Document`, `Message`, `Billing`), keep your
  local types as thin client-scoped views of the same shapes rather than
  redefining them independently — this avoids drift when the two modules
  connect.
- **No silent scope creep.** If a requirement isn't in Part A and isn't
  explicitly flagged in Part B/C, don't invent it — flag it back instead of
  guessing. Two nav items (Approvals, Profile) are flagged as likely missing
  from the original walkthrough but present in the sitemap — see Section 4.
- Repeat before every significant file: **clean, small, structured,
  componentized. Never one giant file.**

## 3. Confirmed Stack
Next.js (App Router) hosted on Vercel. Supabase for Postgres, Storage, and
row-level security — this module reads and writes the WhitbyOS module's own
`whitbyos_*` tables directly (see Section 5), scoped by RLS policies keyed
to the logged-in client's permissions, rather than through a duplicate data
layer. Do not create a separate Supabase project or schema for the Client
Portal; it shares the same Supabase project as the base and WhitbyOS
modules. Integration adapters here are read-only awareness only
(Stripe/QuickBooks). Deploy previews go through Vercel's normal PR-preview
flow.

## 4. Folder / Page Build Order

1. **Post-invite Welcome screen** — 3 action buttons + "Go to My Portal"
2. **Home** — Actions Needed, Messages preview, Billing preview, current
   Request(s), Recent Updates
3. **Messages** — same UI pattern as WhitbyOS Messages; client only sees
   threads/groups they're a participant in
4. **Tasks** — Open/Completed filter, checklist-style completed state
5. **Forms** — View/Continue per form
6. **Documents** — Upload button + Requested From You / Shared With You
7. **Requests** — Submit a Request button, Current/Closed sections, inline
   "Submit a New Request" form
8. **Updates** — read-only progress feed (approve/review actions on relevant items)
9. **Billing** — KPI cards, Pay button, Invoice History

> **Flagged additions — confirm with the client before building, but plan
> folder structure to accommodate them:**
> - **Approvals** — a dedicated page (Pending Approvals, Approve/Reject/
>   Request Changes, History), not just buttons embedded in Updates/Home.
>   Both the sitemap and the product-structure tree list this as a standalone
>   nav item.
> - **Profile** — a dedicated account settings page (Basic Profile, Contact
>   Info, Organization, Authorized Contacts, Notifications, Security). The
>   original walkthrough had no account settings screen for clients at all.

## 5. Data Model Notes
- `Request`, `Form`, `Document`, `Message`, and billing/invoice data are
  **owned by WhitbyOS's data model** — this module reads with client-scoped
  permissions, writes only where explicitly allowed (submit request, upload
  a requested document, reply to messages, complete a form, pay an invoice).
- A client-submitted Request must sync into the professional's Requests list
  in WhitbyOS — confirm exact routing/status with Sabahat before building.
- Document visibility is binary per item: Requested from you (needs upload)
  vs. Shared with you (download) — a status/flag on the shared `Document`
  record, not a separate client-side document type.
- Billing is read-mostly: client views balance/invoices and pays; all invoice
  creation/editing happens on the WhitbyOS side.

## 6. Explicitly Out of Scope for This Module
- Partner Center, Academy/LMS — separate internal modules.
- All internal-only WhitbyOS views (work plan builder, playbooks, knowledge
  base, reports, insights, internal notes) — the client never sees these.

## 7. Known Open Questions — Do Not Silently Resolve, Flag in PR
See requirements doc Part C, items 2, 10, 11, 12.
