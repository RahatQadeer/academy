-- =====================================================================
-- Whitby — the thing to do about a Consideration
-- Owner: Sabahat (whitbyos_*)
--
-- A Consideration says what the professional should notice. Some of them also
-- have an obvious answer, and until now the answer was a sentence they had to
-- act on by hand:
--
--   "Whitby could not match any of your Providers to this work, because none
--    of them record what they do. Add a category or specialty to them..."
--
-- Which is correct, and leaves somebody to go and find the Providers screen.
-- These two columns carry the way there, so a Consideration that has an answer
-- can offer it.
--
--   action_href   a path inside this app, or null
--   action_label  what the link says, or null
--
-- Null on both is the normal case: most Considerations are a judgement for a
-- person to make, not a button.
--
-- Deliberately not reusing `source_reference`. That records where the
-- Consideration came from ("Whitby, when this plan was drafted") and is read
-- by Insights as provenance; a destination is a different fact and putting it
-- in the same column would make both untrustworthy.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_considerations
  add column if not exists action_href text,
  add column if not exists action_label text;

comment on column public.whitbyos_considerations.action_href is
  'Where to go to act on this Consideration, as a path inside the app. Null where it is a judgement rather than a step.';
