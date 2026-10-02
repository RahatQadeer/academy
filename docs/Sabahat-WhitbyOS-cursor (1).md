# Cursor Project Context — WhitbyOS (Professional Module)
### Owner: Sabahat

Read `Sabahat-WhitbyOS-Requirements.md` in full before generating any
code — that is now your dedicated combined requirements + database
reference doc (it supersedes the old shared `WhitbyOS-ClientPortal-Requirements.md`
for your module; Rohail's Client Portal doc is being split out
separately). Also read `design-system.md` and `DB-Schema.md` (both in
repo root, pulled from `base`) before writing any UI or migration code —
this file is build-order + engineering-discipline guidance on top of all
three, not a replacement for any of them.

---

## 1. Project Context — Read This First

You (Cursor) are working on **one module** — WhitbyOS (professional platform) —
inside a larger multi-module ecosystem called Private Attaché / Whitby. The
other modules are:

- **Client Portal** — owned by Rohail (tightly coupled — shares the Request,
  Forms, Documents, Messages, and Billing data models with this module)
- **Academy + LMS** — owned by Rahat
- **Partner Center** — owned by Zara
- **Base platform** (shared auth/identity, module switcher, repo skeleton) — owned by Laiba

These modules **will be connected later** into one repo/deployment via the
shared base. WhitbyOS in particular is the **data owner** for Client, Request,
Form, Document, Message, and Billing records that the Client Portal reads with
permission-scoped visibility — build these models with clear internal/
client-visible field flags from day one, not as an afterthought.

Do not build sign-up, login, forgot-password, or the 4-square module selector
— those live in the shared base. Clone the repo only after Laiba pushes the
base, then create your branch from that commit and work inside your module
folder only. Coordinate with Rohail before changing any shared data model.

---

## 2. Code Architecture Rules (apply to every file you generate, every time)

- **Small, focused files.** No file should grow into a monolith. If a
  component, page, or utility file is approaching a few hundred lines, split
  it — this is a hard rule. Never let a single file reach thousands of lines.
  This module has the largest surface area in the whole ecosystem (Requests
  alone has 15 sub-tabs) — discipline here matters more than anywhere else.
- **Split by responsibility, not by convenience.** The Request detail page
  is not one file — it's a shell + 15 route/tab components (Overview,
  WorkPlan, Tasks, Worksheets, Contacts, Forms, Messages, Calendar,
  Documents, Links, Communications, Notes, Insights, Updates, Timeline),
  each further broken into subcomponents. Same for the Build-with-Whitby
  flow — prompt screen, clarifying-questions screen, progress screen,
  proposed-plan-review screen are separate components, not one mega-component
  with conditional rendering.
- **Consistent folder structure.** Group by feature
  (`/whitbyos/clients`, `/whitbyos/requests`, `/whitbyos/requests/work-plan`,
  `/whitbyos/playbooks`, etc.), and within each separate `components/`,
  `hooks/`, `types/`, `utils/`.
- **Reusable UI goes in a shared component layer** inside this module
  (e.g. status badges, KPI cards, the Messages thread UI used in both Clients
  and Requests, the Notes/Insights pattern) — don't duplicate.
- **Types/interfaces are shared and explicit.** `Client`, `Request`,
  `WorkPlan`, `Task`, `Playbook`, `Form`, `Document`, `Message`, `Note`,
  `Insight` — define once in a central types file, import everywhere. These
  types are especially important since Rohail's module reads several of them.
- **No silent scope creep.** If a requirement isn't in Part A and isn't
  explicitly flagged in Part B/C, don't invent it — flag it back instead of
  guessing. This module has a long open-items list (Part C) — check it before
  assuming a feature is out of scope or in scope.
- Repeat before every significant file: **clean, small, structured,
  componentized. Never one giant file.**

## 3. Confirmed Stack
Next.js (App Router) hosted on Vercel. Supabase for Postgres, Auth (only
consumed via the shared base auth layer — do not stand up a second Supabase
Auth flow for this module), Storage (documents, worksheets), and row-level
security enforcing the Internal/Client Visible/Restricted visibility model
and workspace isolation described in the requirements doc. Use the Supabase
client generated from the base schema's types rather than hand-writing
query shapes. Add: audit logging into the base `audit_log` table, an AI
model service adapter for Build with Whitby, and integration adapters for
Stripe, QuickBooks, Gmail, Outlook, Google Calendar, and Outlook Calendar.
Deploy previews go through Vercel's normal PR-preview flow — use that for
review before merging into `base`.

## 4. Folder / Page Build Order

1. **Onboarding wizard** (4 steps)
2. **Home** — attention feed, Whitby Recommends, upcoming calendar
3. **Clients** (list + detail, 7 sub-tabs)
4. **Requests** (list + detail, 15 sub-tabs — build incrementally, one tab at a time; this is the largest surface, don't try to do it in one pass)
5. **Work Plan creation flow** (4 entry paths + full Build-with-Whitby AI flow) — highest complexity, treat as its own mini-project within the module
6. **Playbooks**
7. **Knowledge**
8. **Reports**
9. **Integrations**
10. **Settings**

> Before starting, flag Part C item 1 (global vs. nested navigation) with the
> team — it affects whether Tasks/Messages/Calendar/Companies/Contacts need
> standalone top-level pages in addition to the nested views above. Don't
> guess; the nested build order above is safe to start regardless, but
> confirm before considering the module "done."

## 5. Data Model Notes
- `Request` is shared with Client Portal — build with visibility/permission
  flags per field (internal vs. client-visible), not two separate models.
- `Message` supports DM and Group; groups need `participants[]`. Per client
  instruction, no group-level "client visible" boolean — flagged as possibly
  needing message-level visibility instead (see prior open item).
- `Document` filters are per-client custom categories, not a global enum.
- `Playbook` = a saved/cleaned copy of a successful `WorkPlan`.
- Billing reads QuickBooks (customer match, invoice/payment status, draft
  invoice creation only — never send). Stripe is separate: WhitbyOS
  subscription status, surfaces in Settings, not the client Billing tab.

## 6. Explicitly Out of Scope for This Module
- Partner Center, Academy/LMS — separate internal modules, not integrations.
- Client-side portal screens — Rohail's module (though your data models must
  support the fields the portal reads).

## 7. Known Open Questions — Do Not Silently Resolve, Flag in PR
See requirements doc Part C, items 1, 3–9. Item 1 is the most consequential —
raise it early, before too much nav structure is locked in.
