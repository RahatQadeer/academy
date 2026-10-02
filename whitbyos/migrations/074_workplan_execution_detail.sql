-- 074 — what a Work Plan needs to be an execution plan rather than a list.
--
-- A drafted step was a title, a kind and an offset in days. Everything a person
-- actually needs in order to do the step — what it is for, what it needs before
-- it can start, what it produces, where to go, who to contact — had nowhere to
-- live, so Whitby could not have written it down even if it had worked it out.
--
-- Nothing here is a new concept. `whitbyos_risks`, `whitbyos_decisions` and
-- `whitbyos_workstream_dependencies` have existed since the schema was written
-- and are used by nothing at all; this migration adds only the task-level
-- detail that has no home, and the plan-level record of whether the dates add
-- up.
--
--   description       what the task is, in a sentence or two
--   rationale         why it is in the plan — the thing that makes a generated
--                     plan reviewable rather than taken on faith
--   start_date        when it can begin; `due_date` alone cannot express a task
--                     that takes four days, and the scheduler needs both ends
--   estimated_days    how long the work itself takes, which is the input the
--                     backward pass schedules from
--   required_inputs   documents, information, approvals, accounts and access,
--                     each with whether the workspace already has it
--   expected_output   what exists afterwards that did not before
--   external_links    websites, booking pages, authorities and contacts, each
--                     carrying whether it was verified against a real source
--   provider_id       the firm this task is done with, where there is one
--
-- On the plan, `feasibility` is the scheduler's own answer: whether the target
-- date can be met, and if not, what is in the way. Written by the scheduler and
-- read by the screen, so the warning is a record rather than something
-- recomputed differently in two places.
--
-- All nullable, all additive. Safe to re-run.

alter table public.whitbyos_tasks
  add column if not exists description text,
  add column if not exists rationale text,
  add column if not exists start_date date,
  add column if not exists estimated_days numeric(5,2),
  add column if not exists required_inputs jsonb not null default '[]'::jsonb,
  add column if not exists expected_output text,
  add column if not exists external_links jsonb not null default '[]'::jsonb,
  add column if not exists provider_id uuid references public.whitbyos_providers(id) on delete set null;

alter table public.whitbyos_workplans
  add column if not exists feasibility jsonb;

-- The scheduler walks the graph task by task; both ends of an edge are looked
-- up constantly and neither was indexed.
create index if not exists whitbyos_tasks_dependency_task_idx
  on public.whitbyos_tasks (dependency_task_id)
  where dependency_task_id is not null;

create index if not exists whitbyos_tasks_provider_idx
  on public.whitbyos_tasks (provider_id)
  where provider_id is not null;
