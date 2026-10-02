-- whitbyos/082 — a form knows who made it
--
-- The New Form dialog offers three visibilities, and two of them did the same
-- thing. The client-side policy (client-portal/001) gates on `client_visible`,
-- so `internal` and `restricted` are both simply "not the client's"; on the
-- Whitby side `whitbyos_forms_all` grants every workspace member every row, so
-- nothing separated them at all. "Restricted" was a word on a radio button.
--
-- It is "Only me" now, and this is what makes that true: with a creator on the
-- row, a form marked that way can be shown to the person who made it and to
-- nobody else. Read-side only — the RLS policy still grants the workspace, and
-- narrowing it here would take every other screen's queries with it.
--
-- Nullable, because thirteen forms already exist and none of them recorded one.
-- A form with no creator is nobody's private form: `visibility` decides, and
-- none of the existing rows is restricted.

alter table public.whitbyos_forms
  add column if not exists created_by_user_id uuid references public.users (id);

-- The only query that needs it is "the forms this person may list", which is
-- every form except somebody else's private ones.
create index if not exists whitbyos_forms_created_by_idx
  on public.whitbyos_forms (workspace_id, created_by_user_id);
