-- Whitby's first pass at a task it can do on its own.
--
-- Every task already carries a `kind`: "auto" for organising, researching,
-- summarising or drafting internal material, "approval" for anything a client
-- sees or anything that commits, "manual" for what the professional does
-- themselves. Whitby has been classifying tasks that way since migration 012
-- and nothing has ever read the "auto" value. 164 tasks are marked as work
-- Whitby could have done, and all 164 sat in somebody's list.
--
-- SRS 12.1.4 permits exactly this: Whitby may create reversible internal work
-- on its own, and the professional accepts, corrects or dismisses it. So the
-- draft lands here, on the task, and the task stays open. Nothing is marked
-- complete by a machine and nothing here reaches a client -- 12.1.5 keeps the
-- send behind a person, and the client-facing path is still the one button in
-- `askClientForRequirements`.
--
-- Three columns rather than a table, because there is exactly one of these per
-- task and its whole life is bound to that task: drafted once, read, then kept
-- or dismissed. A table would be a join for every plan render and a second
-- place for a deleted task to leave a row behind.
alter table public.whitbyos_tasks
  -- { summary, sections: [{heading, body}], openPoints: [text] }
  add column if not exists whitby_draft jsonb,
  add column if not exists whitby_draft_at timestamptz,
  -- Set rather than deleted: a dismissed draft stops being offered, and the
  -- plan can still say Whitby did the work. Deleting the row would make the
  -- summary disagree with itself the moment somebody tidied one away.
  add column if not exists whitby_draft_dismissed_at timestamptz;

-- The plan's "what Whitby did" panel asks one question of every task on it:
-- is there a draft still standing. Partial, because the rows that have one are
-- a small minority of a table that holds every task in the workspace.
create index if not exists whitbyos_tasks_whitby_draft_idx
  on public.whitbyos_tasks (workstream_id)
  where whitby_draft_at is not null and whitby_draft_dismissed_at is null;
