# Cursor context — Client Portal

Owner: Rohail  
Branch off `base`: `rohail/client-portal`  
Work in: `/client-portal` (`page.tsx`, `nav.ts`, then your own screens)  
Routes: `/client-portal` — do not put product screens in `/app` or `/base`  
Tables: `client_portal_access_requests`, `client_portal_notification_prefs` only

## Brand

Branded as "[Company Name] Client Portal", never as Whitby. Example: "Acme Client Portal".

## Data model (non-negotiable)

The portal is a permission-scoped read/write layer on Sabahat's `whitbyos_*` tables plus base `documents`. Do not create `client_portal_requests`, `client_portal_documents`, or any forked identity/contact table.

Coordinate daily with Sabahat. Any schema change they make to Requests, Forms, Documents, or Messages hits you the same day.

## Nav

Home, Requests, Calendar, Messages, Updates, Forms, Documents, Billing, Integrations.

Tasks is not a main nav item — client tasks/approvals surface in Home → Action Needed. Profile & Settings lives under the avatar: Profile, Preferences, Notifications, People & Access, Security, Privacy.

Home sub-nav: Overview, Action Needed, Recent Activity.

## Access

The professional sets the account ceiling. Request access is Private to Requestor / Selected People / Client Account. Conversation access can be narrower. Restricted overrides broader access.

Clients cannot grant portal access. They submit a People & Access request (`client_portal_access_requests`). The professional approves, edits, or declines. Only then does Whitby send an invitation through the shared `invitations` table.

## Never show the client

Internal Workplans, Notes, provider research/scoring, risks, internal AI output, professional-only Tasks, internal discussion, a global Timeline.

A Work Plan the professional explicitly shares (WP.17v → "Share this Work Plan with the client") is the one exception. It reaches the Request's Work Plans tab only through `portal_request_plans()` (`migrations/013`, widened by `014`), which returns every task in each visible stream with its status, dates, kind and owner's name — never priorities, next actions, checklists, dependencies, waiting reasons, Considerations or providers. The portal draws it with Whitby's own view components in `clientView` mode, from `whitbyos/lib/plan-math.ts`. Never add a select policy on `whitbyos_workplans` or `whitbyos_workstreams`.

## Design

Same left nav pattern as the professional app. Import from `/base/components`. Module icon uses the portal tan token. Read `docs/design-system.md` before any new screen.
