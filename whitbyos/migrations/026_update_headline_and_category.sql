-- What screens 10 and 10.1 record about an update.
--
-- `whitbyos_updates` has one `body`, and the card draws two things: a headline
-- in 14.5px semibold and the summary beneath it. Packing both into `body` would
-- mean the list guessing where one ends, and the client portal — which reads
-- these same rows — guessing the same way.
--
-- `category` is 10.1's second select (General, Milestone, Deadline, Blocker,
-- Decision Needed) and appears as a pill on the card. Text rather than an enum:
-- the SRS does not fix this list, and an enum would need a migration the first
-- time a firm wants one of its own.
--
-- `urgent` is what the export draws as a red-bordered card with an Urgent pill.
-- 10.1 attributes it to Whitby ("flagged this as urgent — mentions a deadline"),
-- but the professional is the one who publishes, so it is a field they own
-- rather than something derived and unarguable.
--
-- 10.2's "Linked to Task" is a real link, so it is one.

alter table public.whitbyos_updates
  add column if not exists headline text;

alter table public.whitbyos_updates
  add column if not exists category text;

alter table public.whitbyos_updates
  add column if not exists urgent boolean not null default false;

alter table public.whitbyos_updates
  add column if not exists linked_task_id uuid references public.whitbyos_tasks (id) on delete set null;
