# Client Portal — RLS review request

**From:** Rohail (`client-portal`)
**Sign-off needed:** Sabahat (`whitbyos_*` policies), Laiba (base tables)
**Under review:**
- `client-portal/migrations/001_client_identity_and_rls.sql` — additive
- `client-portal/migrations/002_base_policy_fixes.sql` — narrows three base policies

**Status:** written, **not applied**. Nothing has touched the shared project.

Verified against a `supabase db dump` of the live project on 17 Aug, *after*
Sabahat's `001` and `002` staff policies landed.

---

## What I'm asking for

1. **Sabahat** — twelve **added** policies on `whitbyos_*`. None of your 17
   `_staff` policies is dropped, edited, or reordered.
2. **Laiba** — one `client_portal_`-prefixed link table, client-side read
   policies on `contacts` and `documents`, and separately (file `002`) three
   narrowing fixes to existing base policies.

No table or column in `DB-Schema.md` changes.

---

## This is not a gap in the schema

Stating it plainly because it has already caused one round of confusion: **the
schema is complete.** Every table and column in `DB-Schema.md` exists and is
correct. Nothing structural is missing.

**RLS is not schema.** The gap is in policies, and it only appears for a reader
who is a client rather than a member of staff.

## The evidence

**72 policies are now deployed** (up from 54 before Sabahat's files landed).
Every one guarding a table the portal must read resolves the same way:

```sql
whitbyos_requests_all   USING (is_workspace_member(workspace_id))
whitbyos_clients_all    USING (is_workspace_member(workspace_id))
whitbyos_messages_all   USING (is_workspace_member(workspace_id))
whitbyos_forms_all      USING (is_workspace_member(workspace_id))
whitbyos_calendar_all   USING (is_workspace_member(workspace_id))
```

Sabahat's 17 new `_staff` policies resolve the same way by design — they are
staff policies.

A client is a `contacts` row. They are not in `workspace_members`, and must not
be: that would hand them the professional's entire workspace. So
`is_workspace_member()` is false for them everywhere, and a Client Portal login
matches **zero rows on every table**.

Prior to that: **nothing maps a login to a person.** `contacts` has no `user_id`
column (confirmed against the live table), and `contacts_select` itself requires
workspace membership — so a client cannot read even their own contact record.

Neither is an oversight in the schema doc. `DB-Schema.md` and `base/cursor.md`
§3.4 both name RLS as the enforcement mechanism for the Internal / Client Visible
/ Restricted model. That model simply had no client side written yet.

---

## Sabahat — this slots into your convention, not around it

Your `whitbyos/migrations/README.md` says:

> Policy names end in `_staff`. Postgres combines multiple policies on a table
> with `OR`, so the Client Portal can add its own `_client` policies to the same
> tables later and both will apply. Neither side has to drop or edit the other's.

That is exactly what `001` does. I have renamed every policy of mine to end in
`_client` to match. I have also moved my SQL out of `/supabase/migrations` into
`client-portal/migrations/`, mirroring your folder and for your stated reason —
the shared folder is Laiba's and four branches editing it would collide.

**We overlap on exactly three tables**, all three of which had RLS enabled with
no policy until your `001`:

| Table | Yours | Mine |
|---|---|---|
| `whitbyos_updates` | `whitbyos_updates_staff` | `whitbyos_updates_select_client`, `whitbyos_updates_insert_client` |
| `whitbyos_form_submissions` | `whitbyos_form_submissions_staff` | `whitbyos_form_submissions_select_client`, `..._update_client` |
| `whitbyos_message_participants` | `whitbyos_message_participants_staff` | `whitbyos_message_participants_select_client` |

No name collisions, and permissive policies OR together, so staff access is
unchanged and client access is added alongside.

One note on `whitbyos_message_participants_staff`: it scopes through
`whitbyos_messages`, so a thread with a participant row but no message yet is
invisible to staff. My `portal_start_thread()` inserts the participant before the
first message, but it is `SECURITY DEFINER` so it is not affected. Worth knowing
if you build thread creation on the professional side.

**Two open questions for you.**

**1.** `portal_submit_request()` sets `status = 'open'` (the column default).
What status should a client-originated request enter your queue in, and does it
need triage before counting as active work? One line.

**2. Your `005` Work Summary needs a sharing flag before I can render it.**
`005_request_work_summary.sql` adds `work_summary` and `closed_by_user_id` and
nothing else. SRS 6.16.2 permits sharing an *approved* Work Summary, and 6.16.4
lists "produce the Work Summary" and "produce a client-safe summary if needed"
as two separate closeout steps — so a non-null `work_summary` is not on its own
something the client may see.

I have no column to gate on. Every other client-visible surface in this module
keys on an explicit flag — `whitbyos_updates.status = 'published'`,
`documents.visibility = 'client_visible'`, `whitbyos_calendar.client_visible` —
and reading "closed and non-null" as consent would put an unreviewed internal
summary in front of the client. So the portal side is built and switched off:
`WORK_SUMMARY_IS_SHAREABLE` in `client-portal/lib/data/requests.ts` is `false`
and the column is not in the select list.

Add `work_summary_shared_at timestamptz` (or a boolean — your call) and I flip
one constant. **No policy change needed either way** — `work_summary` is a
column on `whitbyos_requests`, which `001`'s select policy already covers, so
the moment it is populated it is readable by any permitted client. That is
precisely why the gate has to exist on your side rather than mine.

---

## What `001` does

### The identity link

```sql
create table public.client_portal_identities (
  user_id    uuid primary key references public.users (id)        on delete cascade,
  contact_id uuid not null unique references public.contacts (id) on delete cascade
);
```

A `client_portal_`-prefixed join table rather than a `user_id` column on
`contacts`: this module owns the mapping between a login and the person it
represents, base keeps sole ownership of the contact record. Laiba — if you'd
rather it be a column on `contacts`, say so, it's one line in my resolver.

Email matching is implemented as a fallback but is not a long-term path: emails
change, alias to the same inbox, and differ in case, none of which should
silently re-point a login at another person's client record.

### Resolver functions

Seven, all `SECURITY DEFINER STABLE` — definer so a policy calling them doesn't
recurse into the policy being evaluated, stable so Postgres evaluates them once
per statement rather than once per row.

They encode the SRS rules directly:

| Rule | Where |
|---|---|
| 13.14.14 — `client_account` visible to all permitted members; `selected_people` / `private_to_requestor` need an explicit participant row | `portal_can_see_request()` |
| 13.6.4 — a participant added `from_added` sees only messages after they joined | `portal_thread_history_from()` |
| 13.5.3 — internal deadlines never auto-visible | calendar policy requires `client_visible = true` |
| 13.9.5 — internal files always private | document policies require `visibility = 'client_visible'` |
| Draft/review updates are internal | update policy requires `status = 'published'` |

### Client writes, each narrowly constrained

- `whitbyos_updates` insert — **only** `type = 'plans_update'`, so a client can
  never author a Progress Update about themselves
- `whitbyos_form_submissions` update — only rows on their own client account
- `whitbyos_messages` insert — only into a thread they actively participate in,
  as `sender_type = 'contact'` with their own `sender_id`
- `documents` insert — only `visibility = 'client_visible'`, never internal or
  restricted

### Two RPCs

`portal_submit_request()` and `portal_start_thread()`, `SECURITY DEFINER`,
`EXECUTE` granted to `authenticated` only.

They exist because those writes span two tables and deadlock against their own
policies otherwise: a client-created request is `private_to_requestor`, so
between the request insert and the participant insert the client cannot `SELECT`
the row they just created, and `INSERT ... RETURNING` fails against their own
row. Each function does both in one transaction.

---

## What `002` does — Laiba only

Split into its own file so `001` can be approved without it. All three affect
**zero rows today** (`documents` and `document_labels` are both empty), which
makes now the cheapest moment to fix them.

**1. `documents_select` leaks across clients.** It currently includes:

```sql
OR (visibility = 'client_visible' AND has_entitlement('client_portal'))
```

No client scoping at all — any portal-entitled user can read every
`client_visible` document in the system, including other clients'. `002` removes
that clause; `001`'s `documents_select_client` restores properly scoped access.

**2. `document_labels_all` is effectively `auth.uid() IS NOT NULL`.** Written
`using (created_by_user_id = auth.uid() or auth.uid() is not null)` — the second
clause makes the first redundant and the whole thing true for everyone signed in.

**3. `client_portal_notification_prefs_all` is also `auth.uid() IS NOT NULL`.**
Any authenticated user can read and rewrite anyone's preferences. My table, my
bug — fixed in `001` since it's mine, not `002`.

## One thing I did not touch

`storage_documents_authenticated` grants every authenticated user full access to
the `documents`, `avatars`, and `academy` buckets. Anyone signed in can enumerate
and read any client's files directly from storage, bypassing the `documents`
table entirely.

Narrowing it could break Academy and Partner Center uploads, so it needs a
cross-module owner rather than a unilateral change from me. The portal's own path
is safe — signed URLs are minted server-side only after an RLS-checked read of
the `documents` row — but this should be scoped before any real client file is
stored. **Laiba, this one needs an owner.**

---

## Separate issue: the migrations folder no longer describes the database

Found while verifying the above, unrelated to my change but worth fixing while
it's cheap.

**Two tables exist in the live database that are in no migration file anywhere in
the repo:**

| Table | Owner | In `supabase/migrations`? | In the module's own folder? |
|---|---|---|---|
| `whitbyos_workspace_settings` | Sabahat | No | No |
| `academy_roles` | Rahat | No | No |

The enum `public.academy_role` is likewise undeclared in the repo. Both tables
were created directly against the project.

The consequence is that `supabase/migrations` is no longer a complete
description of the schema. A fresh environment, a `db reset`, or onboarding a
sixth developer would produce a database missing these tables, and the failure
would surface as application bugs rather than migration errors.

**Also:** `supabase migration list` shows no migration history recorded on the
remote at all — every local migration has an empty `remote` column, even though
the tables exist. Whoever set the project up applied the SQL outside the CLI.
Worth running `supabase migration repair --status applied 00001…00009` so the
next `db push` doesn't try to replay the entire schema.

Neither issue blocks my change. Both get more expensive the longer they sit.

---

## To apply

Paste into the SQL Editor in this order:

1. `client-portal/migrations/001_client_identity_and_rls.sql`
2. `client-portal/migrations/002_base_policy_fixes.sql`
3. `client-portal/migrations/seed_test_account.sql` — provisions one working
   client login for testing. Idempotent, looks the person up by email.

The seed sets up **two accounts on purpose**: `rohailahmed303@gmail.com` as the
professional (owns the workspace and the client record, and is a workspace
member so Whitby's Clients screen works) and `rohail12@yopmail.com` as the portal
login, deliberately **not** a workspace member. If the portal login were also a
member of the workspace serving it, `is_workspace_member()` would return true and
the session would sail through the `_staff` policies — the portal would look like
it works while never exercising a single client-side policy. Its verification
query asserts `client_is_workspace_member = false` for exactly that reason.

## The alternative I considered

Route the portal's reads through the **service-role key** server-side and match
login to contact by email. Zero database changes, works today.

Not proposing it. It moves every client-isolation rule into application code,
where one missed `.eq("client_id", …)` leaks another client's documents with no
database backstop — and it contradicts what `base/cursor.md` §3.4 says RLS is
there to do. Naming it so the tradeoff is explicit rather than assumed.
