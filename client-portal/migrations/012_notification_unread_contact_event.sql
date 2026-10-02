-- =====================================================================
-- An unread notice to a client is one event, as it already is for a member.
-- Needs sign-off from: Sabahat (`whitbyos_*`).
--
-- whitbyos/069 made (recipient_user_id, kind, entity_id) unique while unread,
-- so a double-submit cannot ring a professional's bell twice. Rows addressed
-- to a contact were left out of it, and the portal now has a bell of its own
-- that the professional side writes to: a document shared, a form sent, a
-- request closed, a message, an invoice. `notifyClientContacts` already skips
-- an event that has an unread notice; this is the same rule held by the
-- database, for the two presses that arrive together.
--
-- Partial on `read_at is null` for the same reason as 069: once it has been
-- read, the next message on the same thread is news again.
--
-- Safe to re-run. If an environment already holds duplicate unread rows for a
-- contact the index will refuse to build; mark the older ones read first:
--
--   update public.whitbyos_notifications n set read_at = now()
--   where n.read_at is null and n.recipient_contact_id is not null
--     and exists (
--       select 1 from public.whitbyos_notifications m
--       where m.read_at is null
--         and m.recipient_contact_id = n.recipient_contact_id
--         and m.kind = n.kind and m.entity_id = n.entity_id
--         and m.created_at > n.created_at
--     );
-- =====================================================================

create unique index if not exists whitbyos_notifications_unread_contact_event
  on public.whitbyos_notifications (recipient_contact_id, kind, entity_id)
  where read_at is null
    and recipient_contact_id is not null
    and entity_id is not null;
