-- =====================================================================
-- Whitby — whether the web lookup behind a plan actually happened
-- Owner: Sabahat (whitbyos_*)
--
-- Before drafting, Whitby searches for the practical externals a piece of work
-- needs: the authority, the booking page, published telephone numbers. That
-- call is deliberately never fatal — a plan without external links is a
-- smaller plan, not a broken one — which means it fails silently, and a plan
-- with no phone numbers on it looks exactly like work that needed none.
--
-- Silent is fine for the drafting. It is not fine for the person reading the
-- plan afterwards, who has no way to tell "there was nothing to find" from
-- "the model was busy for nine seconds". So the outcome is recorded:
--
--   'ok'       the search ran and returned something
--   'empty'    it ran and found nothing to report
--   'failed'   it could not be reached, or refused (quota, load)
--   'skipped'  not attempted — a refinement, or no key configured
--   null       drafted before this column existed
--
-- Only 'failed' is actionable, and that is what the plan offers to redo.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_workplans
  add column if not exists research_state text;

comment on column public.whitbyos_workplans.research_state is
  'Outcome of the grounded web lookup that ran before drafting: ok, empty, failed, skipped. Null for plans drafted before migration 076.';
