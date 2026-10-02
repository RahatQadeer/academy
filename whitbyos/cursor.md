# Cursor context — Whitby (Professional Center)

Owner: Sabahat  
Branch off `base`: `sabahat/whitbyos`  
Work in: `/whitbyos` (`page.tsx`, `nav.ts`, then your own screens)  
Routes: `/whitbyos` — do not put product screens in `/app` or `/base`  
Tables: `whitbyos_*`  
Shared: `/base`, `docs/design-system.md`, `docs/DB-Schema.md`, SRS

## Brand

Private Attaché is the app shell (upper-left logo). Whitby is the intelligent coordination layer. Use "Ask Whitby", "Build with Whitby", "Draft with Whitby". Never "Whitby OS".

Operating spine: Client → Request → Workplan → Workstreams → Tasks and Work Products → Completion.

## Stack

One Next.js app. One Supabase project. Import types and UI from `/base`. Do not create a second auth, a second documents table, or a second contact/company model.

## What you own

Clients, Requests, Workplans, Workstreams, Tasks, Forms, Worksheets, Playbooks, Providers, Messages, Notes, Considerations, Decisions, Risks, Updates, Timeline, Knowledge, Integrations.

Nav: Home, Clients, Contacts, Providers, Requests, Playbooks, Tasks, Calendar, Messages, Updates, Forms, Documents, Knowledge, Insights, Reports, Integrations, Settings.

Companies live inside Contacts, not as a top-level nav item. Documents use base `documents`. Contacts/Companies use base tables. Provider is a role on Contact/Company, never a duplicated person.

## Visibility

Every object is Internal, Client Visible, or Restricted. Rohail's Client Portal reads the same `whitbyos_*` rows through this layer. Tell Rohail before you change Requests, Forms, Documents, or Messages.

## Whitby AI rules

Whitby may draft reversible internal work. It must not take material external actions, spend money, change permissions, or make commitments without human review. Preserve source links. Never auto-create work from a Consideration.

Workplan start paths: Build with Whitby, Use a Playbook, Import an Existing Plan, Start Blank.

## Coordination

- Confirm `contacts` / `companies` fields with Laiba before Zara depends on them.
- Emit a product-qualifying action when a Stripe subscription activates (Zara's attribution).
- Academy Training Workspace: Rahat will ask you to provision a restricted workspace with 90-day expiry.

## Design

Match `docs/design-system.md`. Reuse `/base/components`. Warm canvas `#f1f1ef`, ink `#37352f`, one accent `#2383e2`. No webfonts, no extra brand colors, no "Whitby OS" labels.
