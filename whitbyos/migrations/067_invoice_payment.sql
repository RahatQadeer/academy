-- 067 — an invoice can be paid, not only recorded as paid.
--
-- 059 gave an invoice `paid_at` and `paid_note`, and both were written by hand:
-- the professional marking down what arrived by wire or cheque. The portal's
-- own Pay button refused, because there was nothing behind it. SRS 13.10.2 puts
-- "any applicable payment actions" in front of the client, and 17.7.9 makes
-- Stripe the source of truth for anything Stripe collected, so the button now
-- opens Stripe Checkout and this is where the answer lands.
--
-- WHY TWO IDS AND NOT ONE FLAG
-- `paid_at` already says whether it is paid, and a boolean beside it would be
-- the same fact twice. What is missing is *which* payment paid it, and that is
-- two different Stripe objects: the Checkout Session is what the client was
-- sent to, and the PaymentIntent is what actually took the money. Keeping both
-- is what makes a payment traceable in the Stripe dashboard from the invoice,
-- and what lets a webhook recognise a delivery it has already handled.
--
-- THE SESSION ID IS UNIQUE, AND THAT IS THE IDEMPOTENCY.
-- Stripe retries a webhook until it is acknowledged and can deliver the same
-- event twice. `whitbyos_billing_events` already stops a replay of the same
-- event id, but two different events can describe the same payment. Marking
-- paid is therefore conditional on the invoice not already being paid, and the
-- unique index means the same session cannot be recorded against two invoices.
--
-- Partial, on `is not null`: an invoice paid by wire has no session, and all of
-- them would otherwise collide on null.
--
-- Additive and nullable throughout, so an invoice paid the old way is
-- untouched and `markInvoicePaid` keeps working exactly as it did.

begin;

alter table public.whitbyos_invoices
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists whitbyos_invoices_stripe_session_idx
  on public.whitbyos_invoices (stripe_session_id)
  where stripe_session_id is not null;

commit;

-- =====================================================================
-- VERIFY — two columns and the partial unique index.
-- =====================================================================
-- select column_name from information_schema.columns
-- where table_name = 'whitbyos_invoices'
--   and column_name in ('stripe_session_id', 'stripe_payment_intent_id');
--
-- select indexdef from pg_indexes
-- where indexname = 'whitbyos_invoices_stripe_session_idx';
