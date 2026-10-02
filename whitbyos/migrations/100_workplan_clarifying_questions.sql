-- Whitby asks before it drafts.
--
-- Build with Whitby read the description and went straight to a plan. What
-- it could not do was say "I do not know enough yet" — the ambiguity it
-- noticed came back afterwards, as `missing_info` considerations on a plan
-- already built around a guess.
--
-- So a plan can now sit in an `asking` state: the row exists, the work it is
-- for is recorded, and what is missing is a short list of questions waiting
-- on the professional. Answers fold into the drafting context; anything left
-- unanswered becomes a consideration the way it always did, so skipping
-- costs nothing that was not already being lost.
--
-- Both columns are jsonb arrays. Questions are written once by the model,
-- answers once by the person, and neither is queried by field — this is a
-- scratchpad between two steps of one wizard, not a table of records.

alter table public.whitbyos_workplans
  drop constraint if exists whitbyos_workplans_drafting_state_check;

alter table public.whitbyos_workplans
  add constraint whitbyos_workplans_drafting_state_check
    check (drafting_state in ('asking', 'drafting', 'ready', 'failed'));

alter table public.whitbyos_workplans
  add column if not exists drafting_questions jsonb,
  add column if not exists drafting_answers jsonb;

-- A plan waiting on somebody is the one thing a list of plans most wants to
-- find, and `drafting_state` already carries an index only for 'drafting'.
create index if not exists whitbyos_workplans_asking_idx
  on public.whitbyos_workplans (drafting_state)
  where drafting_state = 'asking';
