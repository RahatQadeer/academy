-- 072 — signing, as a round trip between the two sides rather than an errand
-- run in somebody else's product.
--
-- A document could record `signed_date` and nothing else: not who was being
-- asked, not whether they refused, not what they said about it. So the screens
-- could only ever offer "upload the signed copy" and had to apologise for the
-- e-signature integration that was meant to fill the gap. That integration is
-- gone; this is what replaces it.
--
-- Four columns, all nullable, all additive — `documents` is base, shared with
-- the Portal, the Academy and the Partner Center, and nothing that reads it
-- today can notice these.
--
--   signature_required_from  which side has to sign: 'client' or 'professional'
--   signature_state          'awaiting', then 'signed' or 'declined'
--   signature_note           what the signer typed when they acted
--   signature_actioned_at    when they did
--
-- `signed_date` is left exactly as it is. It answers "when was this signed",
-- which is a property of the document, and it is read in both products already.
-- `signature_state` answers "where is this in the asking", which is a different
-- question and needed its own column rather than an overloaded one.
--
-- Safe to re-run.

alter table public.documents
  add column if not exists signature_required_from text,
  add column if not exists signature_state text,
  add column if not exists signature_note text,
  add column if not exists signature_actioned_at timestamptz;

alter table public.documents
  drop constraint if exists documents_signature_required_from_check;
alter table public.documents
  add constraint documents_signature_required_from_check
  check (signature_required_from is null or signature_required_from in ('client', 'professional'));

alter table public.documents
  drop constraint if exists documents_signature_state_check;
alter table public.documents
  add constraint documents_signature_state_check
  check (signature_state is null or signature_state in ('awaiting', 'signed', 'declined'));

-- The one query both products run: what is waiting on me.
create index if not exists documents_signature_waiting_idx
  on public.documents (signature_required_from, signature_state)
  where signature_state = 'awaiting';
