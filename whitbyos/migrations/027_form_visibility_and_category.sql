-- What screens 11, 11.1 and 11.1b record about a Form.
--
-- The list draws a visibility pill on every row — Client Visible, Internal —
-- and 11.1's New Form asks for it as one of three (Internal, Client Visible,
-- Restricted). `whitbyos_forms` has no column for it, so every form would look
-- the same and the answer would be lost the moment it was given.
--
-- Category is the other half of the line under the name ("Onboarding · Used on
-- 12 requests"), and the builder's Settings panel shows it too.
--
-- A submission also has to be able to say what correction was asked for, or
-- "Correction Required" is a state with nothing behind it (11.3's other button).

alter table public.whitbyos_forms
  add column if not exists visibility text not null default 'internal';

alter table public.whitbyos_forms
  add column if not exists category text;

alter table public.whitbyos_form_submissions
  add column if not exists correction_note text;

alter table public.whitbyos_form_submissions
  add column if not exists reviewed_by_user_id uuid references public.users (id);

alter table public.whitbyos_form_submissions
  add column if not exists reviewed_at timestamptz;
