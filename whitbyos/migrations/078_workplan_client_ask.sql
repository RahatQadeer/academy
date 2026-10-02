-- =====================================================================
-- Whitby — the one form a plan uses to ask its client for their half
-- Owner: Sabahat (whitbyos_*)
--
-- Every task has carried `required_inputs` since 074 — the documents, details
-- and decisions it needs before it can start — and the task screen has printed
-- "not held yet" beside each one ever since. That phrase was never a fact.
-- Nothing checked whether the firm held it, nothing could be handed over, and
-- the words did not change after the passport arrived.
--
-- This column is what makes it a fact. A plan's client-side needs are gathered
-- into one Form, sent once as one submission, and from then on a need is
-- "received" because the client's own answer is sitting in that submission's
-- `responses` — not because somebody on the firm's side ticked a box.
--
--   client_ask_submission_id  the whitbyos_form_submissions row holding the ask
--
-- One column rather than a table of needs, and deliberately so:
--
--   * A need's identity is its label, which is derived from the plan's own
--     tasks every time the screen is drawn. Copying those labels into rows
--     would create a second version of them that drifts the moment a task is
--     edited, and the screen would then be reading the copy.
--   * "Received" must come from the client. A client cannot write to the
--     firm's tables (see 073 for the same problem with signatures), so any
--     received flag here would have to be written by the firm — a claim about
--     the client rather than a fact from them. Their answer is the fact.
--
-- Asking again reuses this submission rather than starting a new one, so
-- answers already given stay given and the client is never asked twice for
-- something they have already sent.
--
-- `on delete set null`: losing the form must not take the plan with it. The
-- plan simply goes back to never having asked.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_workplans
  add column if not exists client_ask_submission_id uuid
    references public.whitbyos_form_submissions(id) on delete set null;

comment on column public.whitbyos_workplans.client_ask_submission_id is
  'The form submission this plan used to ask its client for the documents, details and decisions only they can provide. Null where the client has never been asked. Whether any one need has been met is read from that submission''s responses, never recorded here.';

create index if not exists whitbyos_workplans_client_ask_idx
  on public.whitbyos_workplans (client_ask_submission_id)
  where client_ask_submission_id is not null;
