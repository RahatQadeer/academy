-- =====================================================================
-- Whitby — the professional's own edits to what the client is asked for
-- Owner: Sabahat (whitbyos_*)
--
-- 078 made the list of what a client owes, gathered from the plan's own tasks.
-- Gathered is the right default and the wrong last word: the drafter does not
-- know everything, and it is sometimes wrong about who holds what. Two things
-- were missing, and both are the professional overruling the draft.
--
--   client_ask_extra  things to ask for that no task named. A photograph for a
--                     visa form, a reference the registrar asked for last week,
--                     anything the work turned up after the plan was drawn.
--                     [{ "slug": "...", "label": "...", "kind": "document" }]
--
--   client_ask_skip   slugs to leave out. The drafter listed something the
--                     firm provides itself, or something nobody needs after
--                     all. ["firm-s-own-engagement-letter", ...]
--                     ["..."]
--
-- On the plan rather than on the task, deliberately. A requirement belongs to
-- the task that needs it and editing the task's `required_inputs` to change who
-- is asked would rewrite the plan to change a message. These two say what this
-- plan asks its client for, which is a different fact and its own column.
--
-- `not null default '[]'` on both, so every read is an array and nothing has
-- to guard for null. A plan that has never been edited is one with two empty
-- arrays, which is what it is.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_workplans
  add column if not exists client_ask_extra jsonb not null default '[]'::jsonb,
  add column if not exists client_ask_skip jsonb not null default '[]'::jsonb;

comment on column public.whitbyos_workplans.client_ask_extra is
  'Things to ask the client for that no task named, added by the professional. Array of {slug, label, kind}.';

comment on column public.whitbyos_workplans.client_ask_skip is
  'Slugs gathered from the tasks that this plan does not ask its client for. Array of strings. The requirement stays on its task; only the ask leaves it out.';
