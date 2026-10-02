-- 065 — somewhere to put the answer onboarding already asks for.
--
-- Step 1 of onboarding asks "Your Role" — Owner / Principal, Advisor,
-- Coordinator — and `completeAccountStep` writes it to `users.title_role`. That
-- column has never existed, so PostgREST answered every signup with
--
--   Could not find the 'title_role' column of 'users' in the schema cache
--
-- and nobody could get past the first step. The field is optional in the sense
-- that a person need not think about it, but the write is not conditional:
-- `title_role: role || null` sends the key either way, so leaving it alone
-- failed exactly as filling it in did.
--
-- The alternative was to stop writing it, which throws away an answer the form
-- asks for. Asking a question and discarding the reply is the worse of the two.
--
-- `users` is base's table. This follows 056, which added `tour_seen_at` to it
-- the same way: additive, nullable, no default, so nothing that reads `users`
-- today sees any change.
--
-- Named `title_role` to match `contacts.title_role`, which holds the same kind
-- of fact about a person and is what the onboarding action was already written
-- against.
--
-- Re-runnable. One transaction.

begin;

alter table public.users
  add column if not exists title_role text;

comment on column public.users.title_role is
  'What this person does, from onboarding Step 1. Optional; null when unanswered.';

commit;
