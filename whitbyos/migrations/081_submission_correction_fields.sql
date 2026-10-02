-- =====================================================================
-- Whitby — which answers were sent back, not just that something was
-- Owner: Sabahat (whitbyos_*)
--
-- 080 made acceptance per answer. Correction was still per submission: asking
-- for one passport scan again sent the whole form back, cleared every
-- acceptance on it, and reopened four answers nobody had complained about. The
-- note said which one was wrong; nothing else did.
--
--   correction_fields  the field ids sent back, as an array of strings
--                      ["need-both-adults-passports", ...]
--
-- Only these lose their place in `accepted_responses`, so the rest stay
-- accepted and stay locked on the client's side. Cleared on Accept, and
-- rewritten each time a correction is asked for: it describes the correction
-- outstanding now, not every one ever asked.
--
-- `not null default '[]'` so every read is an array. A submission nobody has
-- sent anything back on is one with an empty one.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_form_submissions
  add column if not exists correction_fields jsonb not null default '[]'::jsonb;

comment on column public.whitbyos_form_submissions.correction_fields is
  'The field ids the professional sent back for correction, as an array of strings. Only these are reopened; everything else keeps its place in accepted_responses. Empty where nothing is outstanding.';
