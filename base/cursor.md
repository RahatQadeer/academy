# Cursor Project Context — Base Platform (Shared Auth, Identity, Design System & Module Switcher)
### Owner: Laiba
### Branch: `base` (created off `main`)

---

## 0. Why This Document Matters More Than the Others

Every other module — WhitbyOS/Professional Center (Sabahat), Client Portal (Rohail),
Academy + LMS (Rahat), Partner Center (Zara) — depends on what you build here
before they can meaningfully start. This is not four standalone apps glued
together later; it is one shared identity, one shared design system, one
shared canonical data layer, and one shared repo skeleton, that the other
four build on top of.

**Definition of "done" for this phase:** a user can sign up or log in once,
land on the product switcher showing the products they have access to, enter
a placeholder route inside each module styled per the design system, and the
shared canonical tables (identity, entitlements, contacts, companies,
documents) exist and are migrated. Once that's true, push `base` and the
rest of the team clones and branches off it.

---

## 1. Design System — Read and Apply First

Read `docs/design-system.md` in full
before writing any UI code. It is the single source of visual truth for
every screen, in every module, built by every person on this project —
colors, type scale, spacing, border/shadow rules, and component patterns
(sidebar, buttons, pills, step rows, callouts, module cards, forms, chips,
avatars) are all defined there. Do not invent new patterns where an
existing one in that file already covers the need.

Two corrections to apply on top of that file, since it was drafted before
the final brand direction was locked (also noted inside the file itself,
Section 6):
1.1 The product is **Private Attaché** (app shell / master brand, upper-left
    logo) with **Whitby** as the AI coordination layer inside it (referenced
    in actions like "Ask Whitby," "Build with Whitby"). Never label a screen
    "Whitby OS" — that name is retired. Use "Whitby" alone for the
    professional platform's in-product references, and "Private Attaché" for
    the app shell/brand.
1.2 The product switcher has four real destinations — Whitby, Client Portal,
    Academy, Partner Center — not five. "Partner Program" in the existing
    design-system screen inventory should read "Partner Center."

Build a shared component library (buttons, inputs, pills, sidebar shell,
step rows, callouts, module cards, avatars, toggle) as reusable components
in the base package, so all four module teams import from one place instead
of each rebuilding the same button styling from the token values.

---

## 2. Git Workflow

2.1 Create a branch off `main` called **`base`**. Do all foundational work
    there; do not merge to `main` until the "done" criteria above is met and
    manually verified.
2.2 Push `base` once verified — this is the branch everyone else clones and
    branches from, not `main`.
2.3 Write a root `README.md` with explicit instructions: clone the repo,
    `git checkout base`, then `git checkout -b <name>/<module>` (e.g.
    `sabahat/whitbyos`, `rohail/client-portal`, `rahat/academy-lms`,
    `zara/partner-center`). Work only inside your assigned module folder.
    Do not modify another person's folder or the shared `/base` folder
    without coordinating — see Section 6 for exactly who depends on what.
2.4 Scaffold each of the four module folders with a placeholder route so
    routing/the switcher already works the moment someone clones `base`
    (Section 5).

---

## 3. Confirmed Stack

3.1 **Framework:** Next.js, App Router, deployed on Vercel. Each module
    (`/whitbyos`, `/client-portal`, `/academy`,
    `/partner-center`) is a route group within the one Next.js app
    you scaffold here — not four separate deployments. One Vercel project,
    one production URL, four route groups behind the switcher.

3.2 **Database:** Supabase (Postgres). One Supabase project for the whole
    ecosystem — do not let any module spin up its own Supabase project or
    schema. Every module reads/writes through the one schema defined in
    `docs/DB-Schema.md`.

3.3 **Auth:** Supabase Auth powers the shared sign-up/login/OAuth flow you
    build in Section 7. Every module consumes this one auth session — no
    module re-implements its own login.

3.4 **Row-level security:** Supabase RLS is the enforcement mechanism for
    the Internal / Client Visible / Restricted visibility model (SRS
    Section 9) and for workspace isolation. Write RLS policies as part of
    each table's migration, not as an afterthought — this is what actually
    keeps a client from seeing another client's data or one workspace from
    seeing another's.

3.5 **Storage:** Supabase Storage for documents, worksheets, and
    Academy video/attachment assets. Use signed URLs for anything gated by
    entitlement or visibility rules — never a public bucket for
    Client-Visible-only or paid content.

3.6 **Migrations:** commit the schema from `docs/DB-Schema.md` as versioned
    migrations (Supabase CLI migrations, or Prisma/Drizzle pointed at the
    Supabase connection string) inside `base`, so every module owner pulls
    the same schema via `git pull` + `supabase db push` (or equivalent)
    rather than configuring their own local database by hand.

3.7 **Deploy previews:** every module's PRs get a Vercel preview
    deployment automatically off the one Next.js app — use these for
    review before merging into `base`, and before any module branch merges
    into another's.

3.8 **Environment variables:** Supabase URL, anon key, and service-role
    key are shared secrets set once at the Vercel project level — don't
    let each module owner generate or hardcode their own.

---

## 4. Database — Full Schema Already Defined

The complete field-level schema for base and all four modules is already
written out in `docs/DB-Schema.md`.
The DBs are being set up directly from that document rather than each
module owner improvising their own tables as they go — read it in full
before writing any migration or model code.

Three corrections baked into that schema you should know about going in:
- **Commission rate defaults to the same value (15%) across Academy,
  Platform, and Enterprise** in `partner_commission_rules` — per-partner
  and per-program overrides are still fully supported, but nothing in the
  source material mandates different baseline rates per program, so don't
  invent a split that isn't there.
- **Attribution window defaults to 90 days everywhere, except Enterprise
  Opportunities, which use 180 days** — that's the one distinction the
  source material actually specifies; everything else stays uniform unless
  told otherwise later.
- **Instructor publishing flow:** an Instructor can create and edit content
  in `academy_programs`/`academy_modules`/`academy_lessons` for programs
  assigned to them via `academy_instructor_assignments`, but cannot set a
  program's status to `published` directly. They submit through
  `academy_publish_requests`; once an Admin approves, either the Instructor
  or the Admin can complete the publish. Build the UI and permissions
  around this two-step flow, not direct instructor-publish.

The short version of table ownership (full detail in `docs/DB-Schema.md`):

- **You (base):** `users`, `workspaces`, `workspace_members`,
  `entitlements`, `invitations`, `contacts`, `contact_roles`, `companies`,
  `company_contacts`, `documents`, `document_labels`, `audit_log`,
  `taxonomy_categories`, `taxonomy_subcategories`.
- **Sabahat (`whitbyos_` prefix):** everything in the Professional Center —
  clients, requests, workplans, workstreams, tasks, forms, worksheets,
  playbooks, providers, messages, notes, considerations, decisions, risks,
  updates, timeline, knowledge, integrations.
- **Rohail (`client_portal_` prefix):** almost nothing — just
  `client_portal_access_requests` and `client_portal_notification_prefs`.
  Everything else is read/written directly against Sabahat's `whitbyos_*`
  tables through the permission layer. Do not let a
  `client_portal_requests` or `client_portal_documents` table get created —
  that would fork the data model the SRS explicitly says must stay unified.
- **Rahat (`academy_` prefix, covers both Academy and LMS):** programs,
  modules, lessons, quizzes, questions, enrollments, lesson_progress,
  credentials, instructor_assignments, publish_requests,
  training_workspaces.
- **Zara (`partner_` prefix):** profiles, team_members, programs,
  commission_rules, links_codes, referrals, opportunities,
  attribution_events, earnings, earning_adjustments, payouts,
  tax_profiles.

Set up all schemas from `docs/DB-Schema.md` directly, via versioned Supabase
migrations (Section 3.6), so every dev pulls the same schema via `git pull`
+ `supabase db push` rather than configuring their own DB instance by hand.

---

## 5. Repo / Folder Structure

```
/base                     ← you own this
  /auth                   ← email/password + Google, invite flow, confirm email
  /identity               ← users, workspaces, entitlements, roles
  /switcher                ← the product switcher
  /components              ← shared design-system component library
  /types                  ← User, Workspace, Entitlement, Contact, Company,
                            Document, InvitationToken
  /lib                     ← Supabase client, shared utilities

/whitbyos                  ← Sabahat
/client-portal             ← Rohail
/academy                   ← Rahat (Academy + LMS both live here)
/partner-center            ← Zara
```

Scaffold each module folder with a placeholder route styled per the design
system (e.g. an empty page reading "Whitby — coming soon" using the shared
sidebar shell) so the switcher has real routes and the other four never
have to wire up their own top-level routing entry point.

---

## 6. Team Dependency Map — Who Coordinates With Whom

Put this in the README too. This is what prevents duplicate/overlapping
work once four people are building in parallel.

- **Sabahat ↔ Rohail (tight, daily coordination expected):** Rohail's
  entire module is a permission-scoped read/write layer on Sabahat's
  `whitbyos_*` tables. Any schema change Sabahat makes to Requests, Forms,
  Documents, or Messages needs to be communicated to Rohail before it
  ships, since the Client Portal reads those same tables directly.
- **Sabahat ↔ Zara (schema coordination, not daily):** Partner Center's
  `partner_profiles` depends on the base `contacts`/`companies` tables
  that Sabahat's Professional Center is the primary builder/consumer of.
  Confirm the `contacts`/`companies` schema (fields, enrichment data per
  SRS Section 22) between Sabahat and base before Zara builds on top of it.
- **Zara ↔ Sabahat + Rahat (event/webhook dependency):** Partner Center's
  attribution model (SRS Section 17.5) needs a "product-qualifying action"
  event fired from WhitbyOS (Stripe subscription activation) and from
  Academy (course enrollment). Sabahat and Rahat each need to emit an
  event/webhook Zara's module can consume — agree on the event payload
  shape early rather than after both sides have built something
  incompatible.
- **Rahat ↔ Sabahat (one hand-off point):** the Academy Training Workspace
  (SRS Section 15/18) provisions a restricted WhitbyOS workspace for
  certification learners. This touches Sabahat's `workspaces`/entitlement
  logic — confirm the hand-off contract (what gets created, the 90-day
  expiry mechanism) between Rahat and Sabahat directly.
- **Everyone ↔ Laiba (you):** identity, entitlements, the product switcher,
  and the four canonical/shared tables listed in Section 4 are yours. Any
  module needing a new shared field on `users`, `contacts`, `companies`,
  or `documents` requests it from you rather than adding a local
  duplicate column on their own copy.

---

## 7. Authentication — Screens To Build

(unchanged from prior direction — see SRS Sections 2–4 for full detail)

7.1 Sign Up: Continue with Google (OAuth via Supabase Auth), or Full Name /
    Email Address / Password / Confirm Password → Create Account. Label is
    "Email Address," not "Work Email." After create, show `/check-email`.
    The confirmation link must land on `/auth/callback` then `/confirmed`,
    never a raw Supabase URL as the final screen.
7.2 Login: Continue with Google, or Email Address / Password, "Keep me
    signed in," "Forgot Password" (Login screen only) → Sign In.
7.3 Forgot / Reset Password: triggered from Login only, standard
    email-reset-link flow via Supabase Auth.
7.4 Invitation-based account creation: one generic pattern (base
    `invitations` table, Section 4) reused for client invites and team
    invites — "[Inviter] invited you as [role]" → Accept → Create Password
    (email read-only) → Set Password & Continue.
7.5 Client Portal auth is branded "[Company Name] Client Portal," not
    Whitby — see SRS Section 1.4 and docs/design-system.md Section 6.1.
7.6 Partner Center auth is branded Private Attaché / Partner Center, not
    Whitby.
7.7 Academy: no public instructor sign-up; every new Academy identity
    defaults to Learner; Instructor/Admin roles are assigned only by an
    admin, never self-service.

---

## 8. Product Switcher

8.1 After login, resolve `entitlements` for the user.
8.2 More than one entitlement → show the switcher (Whitby, Client Portal,
    Academy, Partner Center — four squares, not five).
8.3 Exactly one entitlement → route directly there, skip the switcher.
8.4 Confirm with the team whether a product with zero entitlement is
    hidden or shown greyed-out with an apply/explore action (open item,
    SRS Section 6.3) — build the mechanism to support either, don't
    hard-code the decision.

---

## 9. Code Architecture Rules

9.1 Small, focused files — split by responsibility, never a monolith.
9.2 This is the most reused code in the project — every module imports
    from `/base`. Treat every exported type/hook/component as a public API
    other people's Cursor sessions will consume without reading your
    implementation.
9.3 Types are the contract: `User`, `Workspace`, `Entitlement`, `Contact`,
    `Company`, `Document`, `InvitationToken` — define once, export clearly,
    treat any shape change as something to communicate to the whole team.
9.4 Don't build module-specific features here — placeholder routes only
    (Section 5).

---

## 10. Build Order

1. Repo skeleton (Section 5) + README with git workflow (Section 2) and
   the dependency map (Section 6).
2. Design system component library (Section 1).
3. Supabase project setup (Section 3) + base schema: `users`, `workspaces`,
   `workspace_members`, `entitlements`, `invitations`, `contacts`,
   `contact_roles`, `companies`, `company_contacts`, `documents`,
   `document_labels`, `audit_log`, `taxonomy_categories`,
   `taxonomy_subcategories` — full field list in `docs/DB-Schema.md` (Section 4).
4. Sign Up, Login, Forgot/Reset Password (Section 7).
5. Invitation flow (Section 7.4).
6. Product switcher + four placeholder module routes (Section 8, Section 5).
7. Generate and commit the four module `cursor.md` files into their
   respective product folders — see Section 11.
8. End-to-end manual test: create an account, log in, see the switcher,
   enter a placeholder module styled per the design system, confirm
   re-login routing for single- vs. multi-entitlement users.
9. Push `base` to Vercel, confirm the deploy, notify the team.

---

## 11. Generate and Place the Per-Module Cursor Files

Four tailored `cursor.md` files already exist (provided alongside this
file): `Sabahat-WhitbyOS-cursor.md`, `Rohail-ClientPortal-cursor.md`,
`Rahat-Academy-cursor.md`, `Zara-PartnerCenter-cursor.md`. As part of base
setup:

11.1 Copy `Sabahat-WhitbyOS-cursor.md` into `/whitbyos/cursor.md`.
11.2 Copy `Rohail-ClientPortal-cursor.md` into
     `/client-portal/cursor.md`.
11.3 Copy `Rahat-Academy-cursor.md` into `/academy/cursor.md`.
11.4 Copy `Zara-PartnerCenter-cursor.md` into
     `/partner-center/cursor.md`.
11.5 Keep `docs/design-system.md` and `docs/DB-Schema.md` in `/docs` so every
     module's cursor file can reference them with a relative path.
11.6 In each copied file, confirm the "Confirmed Stack" and data-model
     sections point at the actual Supabase project and schema you set up
     in Section 3 and Section 4, replacing any placeholder values with the
     real ones (project URL, table names as actually migrated), so each
     person's Cursor session opens with accurate, current context rather
     than the earlier draft version.

This way, the moment someone clones `base` and checks out their own
branch, their module folder already contains a cursor.md tailored to them,
plus the shared design system and DB schema, sitting right there — they
open Cursor and start immediately instead of hunting for context across
five different documents.

## 12. Known Open Questions — Flag, Don't Silently Resolve
1. Zero-entitlement switcher behavior (Section 8.4).
2. Default landing rules per role — mechanism should exist now, business
   rules TBD.
3. Exact role vocabulary per module — confirm with each owner (see SRS
   Section 9.2 for WhitbyOS's suggested 6-role starting list).
4. Whether Academy/LMS live under one shared folder (recommended, Section
   5) — confirm with Rahat before finalizing.
