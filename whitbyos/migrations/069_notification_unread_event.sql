-- An unread notice is one event. Two inserts for the same person, kind and
-- entity (a double-submit, a retried upload) must not produce two bells.
--
-- Once they have read it, a later event on the same row (a form resubmitted
-- after a correction) is a new notice, which is why this is partial on
-- `read_at is null`.
--
-- Safe to re-run.

create unique index if not exists whitbyos_notifications_unread_event
  on public.whitbyos_notifications (recipient_user_id, kind, entity_id)
  where read_at is null
    and recipient_user_id is not null
    and entity_id is not null;
