-- 11.1b's header — "Duplicated from Confirmation of Receipt · 0 fields used yet".
--
-- Duplicate has always copied a form's fields and forgotten where they came
-- from, so the builder could never say this. It is worth keeping: a template
-- that started as a copy of another is a fact somebody wants when the two drift
-- apart and they are working out which is the one in use.
--
-- `on delete set null`, not cascade. Deleting the form something was copied from
-- must not delete the copy — by the time it has been edited and sent it is its
-- own template, and its parentage is a note about its history rather than a
-- dependency.

alter table public.whitbyos_forms
  add column if not exists duplicated_from_form_id uuid references public.whitbyos_forms(id) on delete set null;
