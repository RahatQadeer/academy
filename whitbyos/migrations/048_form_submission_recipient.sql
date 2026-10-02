-- 11.2 — the two columns on Submissions that could never be filled.
--
-- The table draws Form, Client, Sent To, Status and Date, and drew "—" under
-- Sent To and Date for every row, because sending a form recorded neither. The
-- insert carried the form, the client, the request and a status, and that was
-- all — so who it went to and when were facts the app had never kept.
--
-- Two columns, one fact each:
--
-- `sent_to_contact_id` is who it was sent to. Deliberately not
-- `submitted_by_contact_id`, which is who answered: 11.2 shows a name under
-- Sent To for rows that have no answer yet, and a form sent to one member of a
-- household may well be filled in by another. Folding them together would make
-- that difference unrecordable.
--
-- `sent_at` is when it went. `submitted_at` stays what it is — when it came
-- back — and the Date column shows the later of the two, which is why the
-- reference dates an "Awaiting Response" row and leaves only a Draft blank.

alter table public.whitbyos_form_submissions
  add column if not exists sent_to_contact_id uuid references public.contacts(id) on delete set null;

alter table public.whitbyos_form_submissions
  add column if not exists sent_at timestamptz;
