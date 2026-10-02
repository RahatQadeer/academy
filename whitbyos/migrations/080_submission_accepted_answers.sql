-- =====================================================================
-- Whitby — which answers were accepted, not just that a submission was
-- Owner: Sabahat (whitbyos_*)
--
-- A submission carries one status for the whole form, which is right for a
-- form somebody fills in once and wrong for a Work Plan's client ask. That one
-- grows: the professional sends four things, the client answers two, the
-- professional accepts them, and then a fifth thing is added to the same form.
-- The submission has to go back to `awaiting`, because the client really does
-- have something new to answer — and the two already accepted lost their
-- acceptance with it, because acceptance lived on the submission.
--
--   accepted_responses  a copy of `responses` as it stood when somebody
--                       accepted it
--
-- A copy of the answers rather than a list of their keys, deliberately. An
-- answer that has changed since is not the answer that was accepted: a client
-- who replaces a passport scan with a different file has given something
-- nobody has looked at, and comparing values says so where comparing keys
-- would not.
--
-- Cleared by Request Correction. Sending a submission back says something in
-- it is wrong without saying which part, so nothing in it can still be called
-- accepted.
--
-- `not null default '{}'` so every read is an object. A submission nobody has
-- accepted is one with an empty one, which is what it is.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_form_submissions
  add column if not exists accepted_responses jsonb not null default '{}'::jsonb;

comment on column public.whitbyos_form_submissions.accepted_responses is
  'The answers as they stood when this submission was accepted. An answer that no longer matches its copy here has changed since and is not accepted. Empty where nobody has accepted it, and cleared when it is sent back for correction.';
