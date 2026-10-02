# Client Portal migrations

SQL owned by the Client Portal module, kept here rather than in
`/supabase/migrations` because that folder is shared and Laiba owns it. Same
arrangement as `whitbyos/migrations/`.

**Nothing in here is applied automatically.** These files are written, reviewed,
and only then folded into the shared migration set by its owner. Treat them as
proposals until that happens.

## Files

| File | What it does | Needs sign-off from | Status |
|---|---|---|---|
| `001_client_identity_and_rls.sql` | The login→contact link, seven resolver functions, and client-side policies on `whitbyos_*` and base tables | Sabahat (`whitbyos_*`), Laiba (base) | Applied |
| `002_base_policy_fixes.sql` | Narrows three existing policies that are wider than intended | Laiba | Applied |
| `003_thread_subject_and_read_state.sql` | Client select policy on `whitbyos_message_threads`, and `portal_mark_thread_read()` — so the portal can read a thread's own `subject` and keep `last_read_at` | Sabahat (`whitbyos_*`) | Applied |
| `004_conversation_people_and_live.sql` | `portal_thread_people()` so a client can see *who* is talking to them; fixes `portal_start_thread()` to write a thread row; a trigger keeping `last_message_at` current; realtime | Sabahat (`whitbyos_*`), Laiba (base) | Applied |
| `005_client_visible_tasks.sql` | Client select policy on `whitbyos_tasks`, scoped to `visibility = 'client_visible'` on **either** a Request the client can see or the client account named directly on the Task (`client_id`, whitbyos/044) | Sabahat (`whitbyos_*`) | Applied — re-run it, see below |
| `006_documents_workspace_visibility.sql` | Workspace-side select policy on `documents`, so a document a client uploads is reachable from the professional's own workspace context, not just by the uploader's own workspace membership | Laiba (base) | Unverified |
| `007_form_visibility_gate.sql` | Narrows `portal_form_ids()` and the three Forms/Form Submissions `_client` policies from `001` to also require `whitbyos_forms.visibility = 'client_visible'` | Sabahat (`whitbyos_*`) | Unverified |
| `008_portal_workspace_timezone.sql` | `portal_workspace_timezone()` so the portal can read `workspaces.timezone` — the zone every shared date was decided in — without being granted the workspace row | Laiba (base) | Applied |
| `009_access_request_areas.sql` | `requested_areas` on `client_portal_access_requests`, so a client's ask carries the areas they had in mind and screen 2.1.2.1 does not open blank | — (this module's own table) | Applied |
| `010_form_correction_rounds.sql` | `client_portal_form_corrections`, one row per closed round of the Forms correction loop, so a client can still see what they were asked for after they have answered it | — (this module's own table) | Applied |
| `011_conversation_recipients.sql` | `portal_messageable_contact_ids()`, and re-signs `portal_start_thread()` to take a recipient — so a client can start a conversation *with a named person on their account*, not only with the professional's team | Sabahat (`whitbyos_*`) | Applied |
| `012_notification_unread_contact_event.sql` | Partial unique index so a contact holds at most one unread notice per kind and entity — whitbyos/069's rule, for the portal's bell | Sabahat (`whitbyos_*`) | Applied |
| `013_client_shared_work_plans.sql` | `client_shared_at` on `whitbyos_workplans`, `client_hidden` on `whitbyos_workstreams`, and `portal_request_plans()` — the only read path from the portal onto a Work Plan, returning a fixed client-safe projection of plans the professional shared on WP.17v | Sabahat (`whitbyos_*`), plus a product decision against SRS 13.11.2 | Applied |
| `014_client_plan_mirror_and_request_detail.sql` | Widens `portal_request_plans()` to every task of a shared plan with owner names (all six Whitby views), and adds `portal_request_detail()` — a Request's owner and people by name, its client-visible notes, and owners of its client-visible tasks | Sabahat (`whitbyos_*`) | Applied |
| `015_thread_people_photo.sql` | Adds `photo_url` to `portal_thread_people()` — a professional's `users.avatar_url`, so the portal's Messages draw a face rather than initials. A contact's photo stays out: it is a storage path, not a column, and the reader signs their own | Sabahat (`whitbyos_*`), Laiba (base `users`) | Applied |
| `016_one_conversation_per_person.sql` | `portal_start_thread()` reuses the direct thread those people already have instead of inserting another — the portal's half of "one conversation per person", matched on who is on a thread rather than what it is called | Sabahat (`whitbyos_*`) | Applied |
| `017_messages_replica_identity.sql` | `REPLICA IDENTITY FULL` on `whitbyos_messages` and `whitbyos_message_threads`, so Realtime can still apply RLS when a message is sent by flipping an autosaved draft's status — an UPDATE whose old row the WAL otherwise reduces to its id, which is the event live Messages depends on | Sabahat (`whitbyos_*`) | **Not applied** |
| `018_client_integrations.sql` | A client's own integrations: `client_portal_integrations`, `_integration_credentials`, `_gmail_sources`, `_gmail_extracts` and `_calendar_events`, keyed on the contact — Whitby's integration tables (whitbyos/023, 033, 034, 057, 060) for a person instead of a workspace. RLS on with no policy on all five; the portal reads and writes them on the service role, filtered to the signed-in contact | Laiba (base `contacts`, `workspaces` foreign keys) | **Not applied** |
| `019_plan_tasks_keep_the_order_they_were_put_in.sql` | Redefines `portal_request_plans()` so a Work Stream's tasks come back `order by sort_order nulls last, created_at` — the order `whitbyos/lib/work-plans.ts` has read since whitbyos/091, and the one somebody dragged them into. 014 ordered them by `created_at` alone, so a professional arranged a plan, shared it, and the client opened the same plan in a different order. `sort_order` itself is not returned. | Proposed |
| `020_client_task_completion.sql` | `portal_set_task_done()` — the write half of `005`. A client may set `status`, `completed_at` and `updated_at` on a client-visible Task of theirs, and nothing else on the row; no UPDATE policy is added, so the function is the only route | Sabahat (`whitbyos_*`) | **Not applied** |
| `021_outlook_is_read_too.sql` | `provider` on `client_portal_gmail_sources` and `client_portal_gmail_extracts`, with both unique indexes re-keyed to carry it — so Outlook Mail is read into the same two tables as Gmail without a Graph message id colliding with a Gmail one, and each mailbox keeps its own list of people. The calendar side needed nothing: `client_portal_calendar_events` was keyed on `(contact_id, provider, external_event_id)` from `018` | — (this module's own tables) | **Not applied** |
| `023_client_plan_task_completion.sql` | Widens `portal_set_task_done()` (020) to tasks in a Work Plan shared with the client — exactly the tasks `portal_request_plans()` returns — so a client can mark a shared plan's tasks complete or not complete. Same three columns, no policy added | Sabahat (`whitbyos_*`) | **Not applied** |
| `seed_test_account.sql` | Provisions one working client login for testing. Not a migration. | — | Not applied |

> **The status column is a claim, not a record.** Nothing tracks what has been
> applied — these files are folded into the shared set by hand — so this table
> is only as true as the last person to edit it. On 2026-09-07 it said `004`
> through `010` were all unapplied; the database disagreed. `portal_thread_people`
> and `portal_workspace_timezone` both existed, `client_portal_access_requests`
> had a populated `requested_areas`, and `client_portal_form_corrections` was a
> real table. Four of them had been applied and the table never updated.
>
> `006` and `007` are marked Unverified because their only artefacts are
> policies, and `pg_policies` is not reachable over PostgREST — they cannot be
> checked the way the other four were.
>
> **`005` answered itself.** Running it on 2026-09-16 raised `42710: policy
> "whitbyos_tasks_select_client" ... already exists`, which is what an applied
> policy looks like. What that error does *not* say is which version: the first
> cut of `005` scoped to the Request route alone, and a database still carrying
> it hides every Task named straight to a client with no Request — exactly what
> `/client-portal/tasks` exists to show. The file had no `drop policy if exists`,
> so the one command that would have settled it was the command that failed.
> It is re-runnable now, and running it installs the current two-route
> definition whatever was there before. Check them in the SQL editor before
> assuming either answer:
>
> ```sql
> select tablename, policyname from pg_policies
> where policyname in ('documents_select_workspace',        -- 006
>                      'whitbyos_forms_select_client')      -- 007
> order by policyname;
> ```
>
> For `005`, the question is not whether it is there but which version, so read
> the expression as well. `qual` must mention **both** resolvers; only
> `portal_can_see_request` means the Request-only first cut is still installed:
>
> ```sql
> select policyname, qual from pg_policies
> where tablename = 'whitbyos_tasks' and policyname = 'whitbyos_tasks_select_client';
> ```
>
> This matters because two files here are **not** safe to re-run. `001` and
> `006` create policies with no `drop policy if exists` in front of them, so
> running one that is already applied raises `policy ... already exists`.
> `005` was the third until it was guarded, for the reason above. Every
> file is wrapped in `begin`/`commit`, so such a run rolls back whole and changes
> nothing — an error, not damage — but it is still a question worth answering
> before pasting rather than after. `002`, `003`, `004`, `005`, `007`, `008`,
> `009`, `010` and `011` all guard their own statements and can be re-run
> freely.

Apply in order: `001`, then `002`, then `003`, then `004`, then `005`, then
`006`, then `007`, then `008`, `009`, `010`, then the seed. `001` makes the portal work; `002` closes
pre-existing holes it would otherwise inherit; `003` catches the portal up to
the thread row `whitbyos/014` introduced; `004` gives the people in a
conversation names; `005` gives the portal a read path onto client-visible
Tasks by either route Whitby can name a client by, which nothing granted
before; `006` closes the gap where a
client-uploaded document was invisible to the professional who is supposed to
see it; `007` closes a visibility gap `001` left in the Forms read path, now
that `whitbyos/forms/actions.ts`'s `sendForm()` gives the professional a real
way to put a submission in front of a client; `008` catches the portal up to
`whitbyos/lib/zoned.ts`, which moved every date decision on the professional's
Calendar into the workspace's own zone while the portal was still formatting in
UTC; `009` and `010` add two columns' worth of facts to tables in this module's
own namespace and need nothing from anyone else. The seed depends on the table
`001` creates.

> **`021` needs no sign-off either, and the portal is broken until it runs.**
> Every object is `client_portal_*`. Unlike `009` and `010` it does *not*
> degrade quietly: `saveSources` and `listEmailByPerson` filter on
> `provider`, and PostgREST answers a missing column with `42703` for the whole
> statement — so on a database without `021`, choosing people for either
> mailbox fails and both Email screens come back empty. Gmail's own reading is
> unaffected only because the column defaults to `'gmail'` once the column
> exists. Apply it with the deploy that carries `outlook-mail.ts`, not after.

> **`009` and `010` need no sign-off.** Both are `client_portal_*` — the
> namespace this module owns. `009` adds one column to a table created by
> `supabase/migrations/00005`; `010` creates a new table whose only reference
> into `whitbyos_*` is a foreign key. Neither drops, alters or widens a policy
> belonging to another module, and the portal degrades to today's behaviour
> without either: `requestAccess` retries its insert without the column, and
> `listCorrectionRounds` returns an empty list, which is what the screen drew
> before the history existed.

> **`008` is the only file here that needs nothing from Sabahat.** It reads a
> base column, and the portal falls back to `UTC` — today's behaviour — until it
> is applied, so nothing regresses while it waits.

> **`004` has one section for Sabahat to accept or take over.** The trigger in
> section 3 is the only thing in this folder that changes behaviour on the
> WhitbyOS side. `whitbyos_message_threads.last_message_at` orders the
> professional's inbox and nothing in the database maintains it — it is set by
> hand in `whitbyos/messages/actions.ts`. The portal cannot do the same, because
> `003` grants it select on that table and nothing more, and an update policy
> would hand a client every other column on the thread row. So a client's reply
> currently lands in the thread and leaves it where it was in the inbox. The
> trigger only ever moves the timestamp forward, so it cannot fight the explicit
> writes already in the WhitbyOS action. Move it to `whitbyos/migrations` if you
> would rather own it.

> **`001`'s two message policies are shared with `whitbyos/017`.** That file
> added `status = 'sent'` to `whitbyos_messages_select_client` and
> `_insert_client` so an autosaved WhitbyOS draft can never be read as a sent
> message in the portal. The condition is folded into `001` here as well, so a
> fresh environment gets it from the start. Do not recreate either policy
> without it.

## Why this is needed at all

Every policy that shipped before this answers *"is this person a member of the
workspace?"* via `public.is_workspace_member()`. A client is a `contacts` row,
not a `workspace_members` row — and must not be one, since that would hand them
the professional's entire workspace. So a Client Portal login matches **zero
rows on every table it reads**.

Underneath that, nothing maps a login to a person: `contacts` has no `user_id`
column, and `contacts_select` itself requires workspace membership, so a client
cannot read even their own contact record.

Neither is a gap in `DB-Schema.md` — the schema is complete. `DB-Schema.md` and
`base/cursor.md` §3.4 both name RLS as the enforcement mechanism for the
Internal / Client Visible / Restricted model. That model simply had no client
side written yet, because nothing consumed it until this module.

## Conventions

**Policy names end in `_client`**, pairing with the `_staff` suffix Whitby uses.
Postgres OR-combines permissive policies, so both sides' policies apply to the
same table and neither owner has to drop or edit the other's. Adopted from
`whitbyos/migrations/README.md`.

**`001` adds, never alters.** No policy belonging to another module is dropped
or modified. The only drops are on this module's own `client_portal_*` tables.

**`002` is separated deliberately** because it is the one file that touches
base-owned policies. It can be reviewed, approved, or rejected on its own
without blocking `001`.

**Resolver functions are `SECURITY DEFINER` and `STABLE`** — definer so a policy
calling them does not recurse into the policy being evaluated, stable so Postgres
evaluates them once per statement rather than once per row.

## Two client writes go through RPCs

`portal_submit_request()` and `portal_start_thread()` exist because those writes
span more than one table and deadlock against their own policies otherwise: a
client-created request is `private_to_requestor`, so between the request insert
and the participant insert the client cannot `SELECT` the row they just created,
and `INSERT ... RETURNING` fails against their own row. Each function does both
in one transaction. `EXECUTE` is granted to `authenticated` only.

`011` re-signs it once more as `(p_subject, p_body, p_request_id,
p_recipient_contact_id)`, and the fourth argument is what lets a client say who
a conversation is with. Null keeps `004`'s behaviour exactly — no second
participant, and the thread reaches the professional's shared inbox — so the
"message my team" path is untouched. A non-null one seats another contact from
the same account on the thread, checked against
`portal_messageable_contact_ids()` at the moment of the write rather than
trusted from the form.

It needs no new policy: a contact with a participant row already satisfies
`portal_in_thread()`, which `001`'s message policies key on, so the person named
can read and reply the moment the row exists.

**It is not a privacy boundary, and the screen says so.** `listThreads` in
`whitbyos/lib/messages.ts` selects every thread in the workspace with no
participant filter, so a conversation a client starts with their spouse is read
by the professional's team like any other. That is a deliberate answer rather
than an oversight — the alternative changes what the whole team sees, not just
these threads — but it is only defensible while the portal keeps saying it out
loud, which `NewConversationModal` does.

`004` re-signs `portal_start_thread()` as `(p_subject, p_body, p_request_id)`.
The version in `001` predates `whitbyos/014` and never inserted the
`whitbyos_message_threads` row at all, so a conversation a client started was
invisible to the professional, whose inbox lists *from* that table, and had no
subject on either side. The signature was corrected rather than extended because
nothing called it at the time; `subject` is `NOT NULL` on the table.

**`004` now has a caller, so it is on the critical path.** `startConversation`
in `lib/actions/messages.ts` is the New Conversation button on Messages. Until
`004` is applied, PostgREST cannot find a function of that shape and answers
`PGRST202`; the action recognises that code specifically and says "Starting a
conversation is not switched on for this account yet. Your team can start one
for you." rather than "could not send, please try again" — a retry would never
succeed, and the client is not the reason. Everything else on Messages works
unchanged without `004`.

## What this side now reads from Whitby

**`whitbyos_client_members.permissions` is authoritative for area access.**
`025` added the column and `approveAccessRequest` writes the grants from screen
2.1.2.1 into it. Nothing here read it until now — `getPortalContext` derived
capabilities from `whitbyos_clients.preferences`, which nothing on the WhitbyOS
side has ever written, so an Authorized User granted Documents only still saw
Requests, Messages and Billing.

`lib/access.ts` is the reader, and it is deliberately conservative in one
direction. An empty `permissions` object inherits full access rather than
denying everything, because every membership created before `025` has an empty
object *and* has been working with full access since the day it was made:
reading "not decided" as "denied" would silently revoke access from all of them.
A primary member always holds every area for the same reason — 2.1.2.1 is never
shown for the account holder, so their row is empty and always will be.

**Three areas have no checkbox yet.** `ACCESS_AREAS` in
`whitbyos/lib/access-requests-vocab.ts` offers four — Requests, Messages,
Documents, Billing. The portal has seven screens behind permissions, so
Calendar, Forms and Updates are never written and currently follow whatever
Requests was granted, on the grounds that all three are views onto the same
work. That is a stand-in and it is documented as one in `lib/access.ts`.

*Ask, for Sabahat:* adding `calendar`, `forms` and `updates` to `ACCESS_AREAS`
is a three-line change to that file and needs nothing else — `approveAccessRequest`
already loops over the list, and the portal already prefers a written key over
the derived one, so the three would start being honoured the moment they are
ticked. Not made here, because that file belongs to the WhitbyOS module.

**A client's ask now carries areas too.** `009` adds `requested_areas` to
`client_portal_access_requests`, and `AddPersonModal` collects them. It is a
suggestion, not a grant: the professional still decides on 2.1.2.1, and the
portal says so on the modal. Reading the column on the Whitby side would let the
approval dialog open with the client's ticks already set rather than with the
four defaults.

**Acceptance and correction are per answer, not per submission — and this side
now requires `whitbyos/080` and `081`.** `080` adds `accepted_responses` to
`whitbyos_form_submissions` and `081` adds `correction_fields`. Both are in the
select list in `lib/data/forms.ts`, so unlike every other read documented here
this one does not degrade: PostgREST answers a missing column with `42703` for
the whole statement, `listForms` returns `[]` on error, and a client would see
an empty Forms screen rather than a stale one. Whitby's own README marks both
Applied, which is why the select is written that way — but the two files are the
reason it must stay true, and moving either back would empty the screen.

What the portal does with them is the mirror of `reviewSubmission` in
`whitbyos/forms/actions.ts`. An answer counts as settled when
`accepted_responses[key]` is non-empty *and still equal to* `responses[key]` —
compared by value, so an answer replaced since is not the answer that was
accepted. `forms/detail/page.tsx` hides the control for a settled answer and
`persist` in `lib/actions/forms.ts` re-checks the same rule against the
definition it read, so the lock is enforced rather than drawn. A resubmission
clears `correction_fields`, because the answers it named have just been
replaced.

## Open questions back to Sabahat

**1. Client contacts as Task assignees.** `044`'s own note leaves this open —
"assigning one raises questions the SRS does not answer — what they are notified
by, what they can see when they follow it, whether it appears in their portal.
Left to ask rather than invented." Answering the Portal half: a Task named to a
contact should appear on Home → Action Needed exactly as a client-visible Task
does now, and `client_portal_notification_prefs` already carries an
`action_needed` event to notify on. What it cannot do is link anywhere — the
Portal has no Task detail screen, by SRS 13.2.3. So if assignment is built, the
Portal needs `visibility = 'client_visible'` set alongside it; being an assignee
is not by itself a read grant, and should not become one.

**2. A professional's photo does not reach the Portal.** `app/api/avatar` reads
`users.avatar_url` under the *viewer's* session, and `users` has exactly two
policies — `users_select_self` and `users_select_teammates`
(`shares_workspace_with`). A client is neither, so every professional's avatar
resolves to the blank pixel and the Portal keeps drawing initials while Whitby
now draws faces.

Not fixed here, because the fix is a decision rather than a patch. The Portal's
own upload writes a storage object keyed by `contact_id` and never touches
`users.avatar_url`, so the two sides do not currently agree on where a person's
photo lives. Two options, both cheap once chosen: extend `portal_thread_people()`
to return an avatar reference the same way it already returns a display name, or
give the Portal its own avatar route resolving both stores. The second is only
worth it if a client contact's photo is also meant to reach Whitby.

## What Whitby now expects from this side

**`whitbyos_messages.delivered_at` (whitbyos/035) is written by the recipient,
and the portal is one of the two recipients.** The middle tick is set by
whichever browser Realtime hands the message to first, so a message a
professional sends a client can only be marked delivered from here.
`markDelivered()` in `lib/actions/messages.ts` does it, called from the portal's
`LiveMessages` — deliberately not a call into
`whitbyos/messages/actions.ts`, whose own version checks the participant seat
with `participant_id = auth.uid()`. That is right for a teammate and never true
for a client, who sits on a thread as a `contact` keyed by `contact_id`, so
Whitby's version would refuse every portal delivery silently. Both versions
write with the service role and `is null` on the update, so neither can move a
delivery somebody else already recorded.

Nothing new is needed in SQL for it: `035` adds the column and the portal writes
through the service role.

## Open questions for Sabahat

**1. Client-originated request status.** `portal_submit_request` sets
`status = 'open'` (the column default). What status should a client-originated
request enter the professional queue in, and does it need triage before it
counts as active work? One line to change.

**2. Work Summary needs a sharing flag.** `005_request_work_summary.sql` adds
`whitbyos_requests.work_summary` and `closed_by_user_id`, and nothing else. SRS
6.16.2 allows sharing an *approved* Work Summary, and 6.16.4 lists "produce the
Work Summary" and "produce a client-safe summary if needed" as two separate
closeout steps — so a non-null `work_summary` is not by itself something the
client may see.

There is no column to gate on. Every other client-visible surface here keys on an
explicit flag (`whitbyos_updates.status = 'published'`, `documents.visibility =
'client_visible'`, `whitbyos_calendar.client_visible`), and treating "closed and
non-null" as consent would put an unreviewed internal summary in front of the
client.

The portal side is built and switched off: `WORK_SUMMARY_IS_SHAREABLE` in
`client-portal/lib/data/requests.ts` is `false`, so the column is not even in the
select list. Add something like `work_summary_shared_at timestamptz` (or a
boolean) and the portal flips one constant. A policy change is not needed —
`work_summary` is a column on a table `001`'s select policy already covers.
