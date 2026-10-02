-- 4.4 and 5.1 — the fields the two detail screens read and nothing could hold.
--
-- Both screens exist and both are thinner than the export, because most of
-- what they print has no column behind it. Nine fields, all of them things a
-- person types about a relationship rather than anything the system derives.
--
-- Contacts
--   communication_preferences  4.4's first panel: "Prefers email over phone.
--                              Quiet hours 8:00pm-8:00am ET." Free text, not a
--                              set of toggles — the export writes a sentence,
--                              and the useful part of it is the exception.
--   notes                      4.4's own notes, separate from the above: one is
--                              how to reach them, the other is what to know.
--   timezone                   Printed under the phone number. A name like
--                              "Eastern Time (US)", not an offset, because it
--                              is read rather than computed with.
--
-- Providers
--   next_action                5.1 prints this under Overview, in darker text.
--   qualifications             Evidence & Review: what makes them credible.
--   restrictions               Evidence & Review: what they will not do.
--   missing_information        Evidence & Review: what has not been checked.
--   last_contact_date          Outreach: when they were last spoken to, as
--                              distinct from next_follow_up_date.
--   response_state             Outreach: whether they answered. Free text like
--                              outreach_status beside it, and read through the
--                              same vocabulary module.
--
-- All nullable, all additive. Nothing existing reads or writes these names, so
-- no row changes meaning and every current query returns exactly what it did.

alter table public.contacts
  add column if not exists communication_preferences text,
  add column if not exists notes text,
  add column if not exists timezone text;

alter table public.whitbyos_providers
  add column if not exists next_action text,
  add column if not exists qualifications text,
  add column if not exists restrictions text,
  add column if not exists missing_information text,
  add column if not exists last_contact_date date,
  add column if not exists response_state text;
